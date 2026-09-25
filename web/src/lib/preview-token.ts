import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 5 * 60_000;
const VERSION = "v1";

type ReportIdentity = {
  address: string;
  scores: Record<string, number>;
};

function validSecret(secret: string): boolean {
  return secret.length >= 32;
}

function fingerprint(report: ReportIdentity): string {
  const scores = Object.entries(report.scores)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key, value]);
  return createHash("sha256")
    .update(JSON.stringify([report.address.trim(), scores]))
    .digest("base64url");
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createPreviewToken(report: ReportIdentity, secret: string, now = Date.now()): string {
  if (!validSecret(secret)) throw new Error("preview secret must contain at least 32 characters");
  const expires = now + TOKEN_TTL_MS;
  const nonce = randomBytes(12).toString("base64url");
  const payload = `${VERSION}.${expires}.${nonce}.${fingerprint(report)}`;
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyPreviewToken(
  token: unknown,
  report: ReportIdentity,
  secret: string,
  now = Date.now(),
): boolean {
  if (typeof token !== "string" || !validSecret(secret) || token.length > 512) return false;
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== VERSION) return false;
  const expires = Number(parts[1]);
  if (!Number.isSafeInteger(expires) || expires < now || expires - now > TOKEN_TTL_MS) return false;

  const payload = parts.slice(0, 4).join(".");
  if (parts[3] !== fingerprint(report)) return false;
  const expected = Buffer.from(signature(payload, secret));
  const actual = Buffer.from(parts[4]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
