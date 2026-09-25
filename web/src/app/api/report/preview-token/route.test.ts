import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { verifyPreviewToken } from "../../../../lib/preview-token";
import { POST } from "./route";

const reportRequest = { address: "Václavské náměstí, Praha", lat: 50.0815867, lon: 14.4271699 };
const secret = "0123456789abcdef0123456789abcdef";

afterEach(() => {
  delete process.env.REPORT_PREVIEW_SECRET;
  delete process.env.TRUST_PROXY_HEADERS;
  delete process.env.PMTILES_LOCAL_DIR;
});

function request(origin?: string, body: unknown = reportRequest) {
  return new NextRequest("http://localhost/api/report/preview-token", {
    method: "POST",
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });
}

describe("preview token endpoint", () => {
  it("fails closed without a configured signing secret", async () => {
    expect((await POST(request())).status).toBe(503);
  });

  it("rejects a cross-origin token request", async () => {
    process.env.REPORT_PREVIEW_SECRET = secret;
    expect((await POST(request("https://attacker.invalid"))).status).toBe(403);
  });

  it("issues a report-bound signed token", async () => {
    process.env.REPORT_PREVIEW_SECRET = secret;
    process.env.PMTILES_LOCAL_DIR = "../etl/output/cities";
    const response = await POST(request("http://localhost"));
    expect(response.status).toBe(200);
    const { token, scores } = await response.json();
    expect(scores.schools).toBeCloseTo(0.684, 3);
    expect(verifyPreviewToken(token, { address: reportRequest.address, scores }, secret)).toBe(true);
  });

  it("rejects browser-supplied scores", async () => {
    process.env.REPORT_PREVIEW_SECRET = secret;
    process.env.PMTILES_LOCAL_DIR = "../etl/output/cities";
    const response = await POST(request("http://localhost", { ...reportRequest, scores: { schools: 1 } }));
    expect(response.status).toBe(400);
  });

  it("rejects spoofed forwarding headers unless proxy trust is explicitly enabled", async () => {
    process.env.REPORT_PREVIEW_SECRET = secret;
    const req = request("https://kamvcesku.cz");
    req.headers.set("x-forwarded-host", "kamvcesku.cz");
    req.headers.set("x-forwarded-proto", "https");
    expect((await POST(req)).status).toBe(403);
  });

  it("accepts the public origin reported by explicitly trusted proxy headers", async () => {
    process.env.REPORT_PREVIEW_SECRET = secret;
    process.env.TRUST_PROXY_HEADERS = "true";
    process.env.PMTILES_LOCAL_DIR = "../etl/output/cities";
    const req = request("https://kamvcesku.cz");
    req.headers.set("x-forwarded-host", "kamvcesku.cz");
    req.headers.set("x-forwarded-proto", "https");
    expect((await POST(req)).status).toBe(200);
  });
});
