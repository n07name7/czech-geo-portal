import { type NextRequest, NextResponse } from "next/server";
import { createPreviewToken } from "../../../../lib/preview-token";
import { resolveServerScores } from "../../../../lib/server-report-data";
import { BodyTooLargeError, clientIdentifier, FixedWindowRateLimiter, readLimitedJson, trustsProxyHeaders } from "../../_lib/request-protection";

export const runtime = "nodejs";

const limiter = new FixedWindowRateLimiter(10, 60_000, 1_024);

function isSamePublicOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const trustForwarded = trustsProxyHeaders();
  const host = (trustForwarded ? req.headers.get("x-forwarded-host") : null)
    ?? req.headers.get("host")
    ?? req.nextUrl.host;
  const protocol = (trustForwarded ? req.headers.get("x-forwarded-proto") : null)
    ?? req.nextUrl.protocol.replace(":", "");
  if (host.includes(",") || /\s/.test(host) || !["http", "https"].includes(protocol)) return false;
  return origin === `${protocol}://${host}`;
}

export async function POST(req: NextRequest) {
  const secret = process.env.REPORT_PREVIEW_SECRET ?? "";
  if (secret.length < 32) {
    return NextResponse.json({ error: "preview unavailable" }, { status: 503 });
  }

  if (!isSamePublicOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!limiter.allow(clientIdentifier(req.headers))) {
    return NextResponse.json({ error: "rate limit" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  let body: Record<string, unknown>;
  try {
    body = await readLimitedJson(req, 8_192) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof BodyTooLargeError ? "body too large" : "bad body" },
      { status: error instanceof BodyTooLargeError ? 413 : 400 },
    );
  }

  const keys = Object.keys(body);
  if (
    keys.some((key) => !["address", "lat", "lon"].includes(key)) ||
    typeof body.address !== "string" || body.address.trim().length < 3 || body.address.length > 300 ||
    typeof body.lat !== "number" || typeof body.lon !== "number"
  ) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  let scores: Record<string, number> | null;
  try {
    scores = await resolveServerScores(body.lat, body.lon);
  } catch {
    return NextResponse.json({ error: "rating data unavailable" }, { status: 503, headers: { "Retry-After": "2" } });
  }
  if (!scores) return NextResponse.json({ error: "outside coverage" }, { status: 422 });

  const report = { address: body.address.trim(), scores };
  const token = createPreviewToken(report, secret);
  return NextResponse.json({ token, scores }, { headers: { "Cache-Control": "no-store" } });
}
