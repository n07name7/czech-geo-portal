import { describe, expect, it } from "vitest";
import { buildReportHref } from "./report-link";

describe("buildReportHref", () => {
  it("preserves a selected address and coordinates in the report URL", () => {
    expect(buildReportHref("cs", { label: "Národní 1, Praha", lat: 50.081, lon: 14.426 }))
      .toBe("/cs/report?address=N%C3%A1rodn%C3%AD+1%2C+Praha&lat=50.081&lon=14.426");
  });

  it("returns a report route when no place has been selected", () => {
    expect(buildReportHref("en")).toBe("/en/report");
  });
});
