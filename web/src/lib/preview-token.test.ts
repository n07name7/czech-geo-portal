import { describe, expect, it } from "vitest";
import { createPreviewToken, verifyPreviewToken } from "./preview-token";

const secret = "0123456789abcdef0123456789abcdef";
const report = { address: "Test 1, Praha", scores: { schools: 0.7, air: 0.4 } };

describe("PDF preview tokens", () => {
  it("accepts a short-lived token bound to the same report", () => {
    const token = createPreviewToken(report, secret, 1_000);
    expect(verifyPreviewToken(token, report, secret, 1_001)).toBe(true);
  });

  it("rejects report tampering", () => {
    const token = createPreviewToken(report, secret, 1_000);
    expect(verifyPreviewToken(token, { ...report, address: "Other" }, secret, 1_001)).toBe(false);
  });

  it("rejects expired tokens", () => {
    const token = createPreviewToken(report, secret, 1_000);
    expect(verifyPreviewToken(token, report, secret, 1_000 + 5 * 60_000 + 1)).toBe(false);
  });
});
