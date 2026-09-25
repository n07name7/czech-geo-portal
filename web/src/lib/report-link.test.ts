import { describe, expect, it } from "vitest";
import { buildReportHref, parseReportCoordinates } from "./report-link";

describe("buildReportHref", () => {
  it("keeps the address out of URLs while preserving coordinates", () => {
    const href = buildReportHref("cs", { label: "Národní 1, Praha", lat: 50.081, lon: 14.426 });
    expect(href).toBe("/cs/report?lat=50.081&lon=14.426");
    expect(href).not.toContain("N%C3%A1rodn%C3%AD");
  });

  it("returns a report route when no place has been selected", () => {
    expect(buildReportHref("en")).toBe("/en/report");
  });

  it("does not interpret missing coordinate parameters as zero", () => {
    expect(parseReportCoordinates(new URLSearchParams())).toBeNull();
    expect(parseReportCoordinates(new URLSearchParams("lat=50.081&lon=14.426"))).toEqual({ lat: 50.081, lon: 14.426 });
  });
});
