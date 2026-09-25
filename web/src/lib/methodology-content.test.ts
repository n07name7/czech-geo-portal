import { describe, expect, it } from "vitest";
import { getMethodologyContent } from "./methodology-content";

describe("methodology content", () => {
  it("localizes structural labels for Russian users", () => {
    const content = getMethodologyContent("ru");
    expect(content.eyebrow).toBe("Документация");
    expect(content.columns).toEqual(["Показатель", "Источник", "Период данных"]);
    expect(content.steps[0]).toContain("Ячейки H3");
  });

  it("describes source periods rather than claiming static snapshots update weekly", () => {
    const content = getMethodologyContent("en");
    const noise = content.sources.find((row) => row.id === "noise");
    const air = content.sources.find((row) => row.id === "air");
    expect(noise?.period).toContain("2022");
    expect(air?.period).toContain("2019-2023");
    expect(noise?.period.toLowerCase()).not.toContain("weekly");
  });

  it("does not call undated static snapshots current", () => {
    const content = getMethodologyContent("en");
    for (const id of ["schools", "kindergartens", "playgrounds", "clinics", "pharmacies", "transport", "parks", "sports", "shops"]) {
      const period = content.sources.find((row) => row.id === id)?.period ?? "";
      expect(period).not.toContain("Current");
      expect(period).toContain("extraction date is not recorded");
    }
  });

  it("states that safety is a relative incident-density signal, not a guarantee", () => {
    const content = getMethodologyContent("cs");
    expect(content.limits).toContain("není zárukou osobní bezpečnosti");
  });
});
