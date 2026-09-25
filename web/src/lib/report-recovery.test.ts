import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const report = readFileSync(new URL("../app/[locale]/report/page.tsx", import.meta.url), "utf8");
describe("report recovery integration", () => {
  it("uses visible-time deadlines for map snapshots", () => {
    expect(report).toContain("setVisibleTimeout(");
    expect(report).not.toContain("window.setTimeout(() => {\n      setPdfSources");
  });
  it("distinguishes unavailable scores from missing coverage and exposes retry", () => {
    expect(report).toContain("onStatus={setScoreStatus}");
    expect(report).toContain('scoreStatus === "unavailable"');
    expect(report).toContain('scoreStatus === "outside"');
  });
  it("cancels obsolete address searches", () => {
    expect(report).toContain("if (cancelled) return;\n      setResults");
    expect(report).toContain("cancelled = true;");
  });
});
