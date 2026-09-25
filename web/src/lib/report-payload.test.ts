import { describe, expect, it } from "vitest";
import { validateReportPayload } from "./report-payload";

const valid = { address: "Václavské náměstí 1, Praha", scores: { schools: 0.7, n_schools: 4, rent: 340 } };

describe("validateReportPayload", () => {
  it("accepts a bounded report preview payload", () => {
    expect(validateReportPayload(valid)).toEqual({ ok: true });
  });

  it("rejects non-finite or out-of-range normalized scores", () => {
    expect(validateReportPayload({ ...valid, scores: { schools: 2 } })).toEqual({ ok: false, error: "invalid_scores" });
    expect(validateReportPayload({ ...valid, scores: { schools: Number.NaN } })).toEqual({ ok: false, error: "invalid_scores" });
  });

  it("rejects oversized text and embedded images", () => {
    expect(validateReportPayload({ ...valid, address: "x".repeat(301) })).toEqual({ ok: false, error: "invalid_address" });
    expect(validateReportPayload({ ...valid, mapImage: "x".repeat(1_500_001) })).toEqual({ ok: false, error: "payload_too_large" });
  });

  it("rejects unexpected score keys", () => {
    expect(validateReportPayload({ ...valid, scores: { official_safety_guarantee: 1 } })).toEqual({ ok: false, error: "invalid_scores" });
  });

  it("rejects oversized or malformed nested report data", () => {
    expect(validateReportPayload({
      ...valid,
      nearby: { school: { name: "x".repeat(301), dist: 10, min: 1 } },
    })).toEqual({ ok: false, error: "invalid_payload" });
    expect(validateReportPayload({ ...valid, flags: { road: { dist: -1 } } }))
      .toEqual({ ok: false, error: "invalid_payload" });
    expect(validateReportPayload({ ...valid, isoWalk: { img: "not-an-image", area: 2 } }))
      .toEqual({ ok: false, error: "invalid_payload" });
  });

  it("accepts city rental medians from averages.json while bounding their value", () => {
    expect(validateReportPayload({ ...valid, cityAvg: { schools: 0.057, rent: 346 } })).toEqual({ ok: true });
    expect(validateReportPayload({ ...valid, cityAvg: { rent: 10001 } })).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("accepts a bounded list of unavailable optional sources", () => {
    expect(validateReportPayload({ ...valid, unavailableSources: ["nearby", "flags"] })).toEqual({ ok: true });
    expect(validateReportPayload({ ...valid, unavailableSources: ["arbitrary"] })).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("rejects unknown top-level fields", () => {
    expect(validateReportPayload({ ...valid, arbitrary: { deeply: ["nested"] } }))
      .toEqual({ ok: false, error: "invalid_payload" });
  });
});
