import { describe, expect, it } from "vitest";
import { buildDecisionSummary, calculateProfileScore, PROFILE_IDS } from "./report-insights";

const scores = {
  schools: 0.9,
  kindergartens: 0.85,
  playgrounds: 0.8,
  clinics: 0.7,
  pharmacies: 0.7,
  transport: 0.35,
  parks: 0.8,
  sports: 0.55,
  shops: 0.65,
  quiet: 0.25,
  safety: 0.75,
  highschool: 0.6,
  air: 0.65,
  rent: 220,
};

describe("report decision insights", () => {
  it("exposes the four decision profiles", () => {
    expect(PROFILE_IDS).toEqual(["balanced", "family", "renter", "student"]);
  });

  it("makes the family score prioritize family-relevant strengths over transport", () => {
    const family = calculateProfileScore(scores, "family");
    const renter = calculateProfileScore(scores, "renter");

    expect(family).toBeGreaterThan(renter);
    expect(family).toBeGreaterThan(0.7);
  });

  it("turns scores and local risks into a useful, non-generic verdict", () => {
    const summary = buildDecisionSummary({
      scores,
      profile: "family",
      nearby: {
        school: { name: "ZŠ U Parku", dist: 280, min: 4 },
        park: { name: "Stromovka", dist: 420, min: 6 },
      },
      flags: { railway: { dist: 130 } },
      rent: 220,
      rentCity: 250,
      locale: "cs",
    });

    expect(summary.profileScore).toBeGreaterThan(70);
    expect(summary.strengths.join(" ")).toContain("ZŠ U Parku");
    expect(summary.watchOuts.join(" ")).toContain("Železnice");
    expect(summary.verdict).toContain("rodinu");
  });

  it("does not invent positives or risks when input data is absent", () => {
    const summary = buildDecisionSummary({ scores: {}, profile: "balanced", locale: "en" });

    expect(summary.strengths).toEqual([]);
    expect(summary.watchOuts).toEqual([]);
    expect(summary.verdict).toContain("enough data");
  });

  it("writes strengths, risks and verdict in Russian", () => {
    const summary = buildDecisionSummary({
      scores,
      profile: "family",
      nearby: { school: { name: "Школа у парка", dist: 280, min: 4 } },
      flags: { railway: { dist: 130 } },
      locale: "ru",
    });

    expect(summary.strengths.join(" ")).toContain("Школа у парка");
    expect(summary.watchOuts.join(" ")).toContain("Железная дорога");
    expect(summary.verdict).toContain("семьи");
  });
});
