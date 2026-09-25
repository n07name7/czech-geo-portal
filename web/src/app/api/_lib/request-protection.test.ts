import { describe, expect, it, vi } from "vitest";
import {
  clientIdentifier,
  BodyTooLargeError,
  ConcurrencyGate,
  ConcurrencyLimitError,
  FixedWindowRateLimiter,
  InFlightDeduplicator,
  readLimitedJson,
} from "./request-protection";

describe("request protection", () => {
  it("ignores spoofable client headers without explicit proxy trust", () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "");
    try {
      expect(clientIdentifier(new Headers({ "x-forwarded-for": "203.0.113.1", "x-real-ip": "203.0.113.2" }))).toBe("anonymous");
    } finally { vi.unstubAllEnvs(); }
  });
  it("accepts only a single valid proxy-provided IP after exact opt-in", () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
    try {
      expect(clientIdentifier(new Headers({ "x-forwarded-for": "203.0.113.1" }))).toBe("203.0.113.1");
      expect(clientIdentifier(new Headers({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
      for (const value of ["203.0.113.1, 203.0.113.2", "garbage", "unknown", "203.0.113.1:80"]) {
        expect(clientIdentifier(new Headers({ "x-forwarded-for": value }))).toBe("anonymous");
      }
      expect(clientIdentifier(new Headers({ "x-real-ip": "203.0.113.2" }))).toBe("anonymous");
      vi.stubEnv("TRUST_PROXY_HEADERS", "1");
      expect(clientIdentifier(new Headers({ "x-forwarded-for": "203.0.113.1" }))).toBe("anonymous");
    } finally { vi.unstubAllEnvs(); }
  });

  it("limits repeated client requests within a fixed window", () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000, 4);
    expect(limiter.allow("client", 100)).toBe(true);
    expect(limiter.allow("client", 200)).toBe(true);
    expect(limiter.allow("client", 300)).toBe(false);
    expect(limiter.allow("client", 1_101)).toBe(true);
  });

  it("rejects new work when global concurrency is exhausted", async () => {
    const gate = new ConcurrencyGate(1);
    let release!: () => void;
    const held = gate.run(() => new Promise<void>((resolve) => { release = resolve; }));
    await expect(gate.run(async () => "second")).rejects.toBeInstanceOf(ConcurrencyLimitError);
    release();
    await held;
  });

  it("coalesces identical in-flight work", async () => {
    const deduper = new InFlightDeduplicator();
    const work = vi.fn(async () => 42);
    const [a, b] = await Promise.all([
      deduper.run("same", work),
      deduper.run("same", work),
    ]);
    expect([a, b]).toEqual([42, 42]);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("stops reading JSON bodies beyond the byte limit", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ payload: "x".repeat(100) }),
    });
    await expect(readLimitedJson(request, 32)).rejects.toBeInstanceOf(BodyTooLargeError);
  });
});
