import { isIP } from "node:net";

export class BodyTooLargeError extends Error {
  constructor() {
    super("body too large");
    this.name = "BodyTooLargeError";
  }
}

export class ConcurrencyLimitError extends Error {
  constructor() {
    super("upstream concurrency limit reached");
    this.name = "ConcurrencyLimitError";
  }
}

export class FixedWindowRateLimiter {
  private readonly clients = new Map<string, { windowStart: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxClients: number,
  ) {}

  allow(client: string, now = Date.now()): boolean {
    const current = this.clients.get(client);
    if (!current || now - current.windowStart >= this.windowMs) {
      this.clients.delete(client);
      while (this.clients.size >= this.maxClients) {
        const oldest = this.clients.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        this.clients.delete(oldest);
      }
      this.clients.set(client, { windowStart: now, count: 1 });
      return true;
    }
    if (current.count >= this.limit) return false;
    current.count += 1;
    this.clients.delete(client);
    this.clients.set(client, current);
    return true;
  }
}

export class ConcurrencyGate {
  private active = 0;

  constructor(private readonly maxConcurrent: number) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) throw new ConcurrencyLimitError();
    this.active += 1;
    try {
      return await work();
    } finally {
      this.active -= 1;
    }
  }
}

export class InFlightDeduplicator {
  private readonly active = new Map<string, Promise<unknown>>();

  run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const existing = this.active.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const promise = work().finally(() => this.active.delete(key));
    this.active.set(key, promise);
    return promise;
  }
}

async function readLimitedText(body: ReadableStream<Uint8Array> | null, declaredLength: string | null, maxBytes: number): Promise<string> {
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    throw new BodyTooLargeError();
  }
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

export async function readLimitedJson(request: Request, maxBytes = 2_048): Promise<unknown> {
  const text = await readLimitedText(request.body, request.headers.get("content-length"), maxBytes);
  return JSON.parse(text);
}

export async function readLimitedResponseJson(response: Response, maxBytes = 5 * 1024 * 1024): Promise<unknown> {
  const text = await readLimitedText(response.body, response.headers.get("content-length"), maxBytes);
  return JSON.parse(text);
}

// Enable only behind an ingress that overwrites forwarding headers and blocks
// direct access to this server. Merely running behind a proxy is not sufficient.
export function trustsProxyHeaders(): boolean {
  return process.env.TRUST_PROXY_HEADERS === "true";
}

export function clientIdentifier(headers: Headers): string {
  if (!trustsProxyHeaders()) return "anonymous";
  // Accept only a single, well-formed IP: a chain means unverified hops (the
  // "client" entry could be attacker-supplied), and so do ports or garbage.
  // x-real-ip is never trusted - some proxies pass it through from the client.
  const forwarded = headers.get("x-forwarded-for")?.trim() ?? "";
  return forwarded && !forwarded.includes(",") && isIP(forwarded) ? forwarded : "anonymous";
}

export const liveApiLimiter = new FixedWindowRateLimiter(60, 60_000, 2_048);
const upstreamGate = new ConcurrencyGate(8);
const upstreamDeduper = new InFlightDeduplicator();

export function runProtectedUpstream<T>(scope: string, key: string, work: () => Promise<T>): Promise<T> {
  return upstreamDeduper.run(`${scope}:${key}`, () => upstreamGate.run(work));
}
