import { describe, expect, it } from "vitest";
import { pdfReadiness, type PdfSourceStatus } from "./pdf-readiness";

const ready: PdfSourceStatus = {
  nearby: "ready",
  flood: "ready",
  flags: "ready",
  averages: "ready",
  map: "ready",
  isoWalk: "ready",
  isoDrive: "ready",
};

describe("pdfReadiness", () => {
  it("waits for every source before allowing a complete or partial export", () => {
    expect(pdfReadiness(ready)).toBe("ready");
    expect(pdfReadiness({ ...ready, map: "loading" })).toBe("loading");
    expect(pdfReadiness({ ...ready, isoDrive: "unavailable" })).toBe("partial");
  });

  it("keeps waiting while another source is loading even if one is unavailable", () => {
    expect(pdfReadiness({ ...ready, map: "loading", averages: "unavailable" })).toBe("loading");
  });
});
