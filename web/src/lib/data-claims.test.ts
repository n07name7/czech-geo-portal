import { describe, expect, it } from "vitest";
import cs from "../../messages/cs.json";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import { buildDecisionSummary } from "./report-insights";

const catalogs = [cs, en, ru];

describe("user-facing data claims", () => {
  it("labels nearby travel minutes as a straight-line estimate", () => {
    expect(cs.report.nearbyDesc).toContain("vzdušnou čarou");
    expect(en.report.nearbyDesc).toContain("straight-line");
    expect(ru.report.nearbyDesc).toContain("по прямой");
  });

  it("does not claim that rent is part of the renter profile score", () => {
    for (const catalog of catalogs) {
      expect(catalog.report.profile.renter.desc.toLowerCase()).not.toMatch(/cena|price|цен/);
    }
  });

  it("does not label generic OSM schools as primary schools", () => {
    expect(cs.report.nearCat.school).toBe("Škola");
    expect(en.report.nearCat.school).toBe("School");
    expect(ru.report.nearCat.school).toBe("Школа");
  });

  it("does not present straight-line proximity estimates as walking routes", () => {
    expect(cs.report.feat.nearby.toLowerCase()).not.toContain("chůz");
    expect(en.report.feat.nearby.toLowerCase()).not.toContain("walking");
    expect(ru.report.feat.nearby.toLowerCase()).not.toContain("пеш");

    const summaries = (["cs", "en", "ru"] as const).map((locale) =>
      buildDecisionSummary({
        scores: { schools: 0.8 },
        profile: "family",
        nearby: { school: { name: "Test", dist: 400, min: 5 } },
        locale,
      }).strengths.join(" ").toLowerCase()
    );
    expect(summaries[0]).not.toContain("pěš");
    expect(summaries[1]).not.toContain("walk");
    expect(summaries[2]).not.toContain("пеш");
  });
});
