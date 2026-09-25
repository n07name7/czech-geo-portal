import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createPreviewToken } from "../../../../lib/preview-token";
import { POST } from "./route";

const secret = "0123456789abcdef0123456789abcdef";
const report = { address: "Test 1, Praha", scores: { schools: 0.7 } };

afterEach(() => { delete process.env.REPORT_PREVIEW_SECRET; });

function request(body: unknown) {
  return new NextRequest("http://localhost/api/report/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PDF report route security", () => {
  it("rejects arbitrary mock preview sessions", async () => {
    const response = await POST(request({ ...report, session: "mock_anything" }));
    expect(response.status).toBe(402);
  });

  it("rejects an oversized body before PDF generation", async () => {
    const response = await POST(request({ ...report, padding: "x".repeat(5_100_000) }));
    expect(response.status).toBe(413);
  });

  it("accepts a valid report-bound preview token", async () => {
    process.env.REPORT_PREVIEW_SECRET = secret;
    const previewToken = createPreviewToken(report, secret);
    const response = await POST(request({ ...report, previewToken }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/pdf");
  });
});
