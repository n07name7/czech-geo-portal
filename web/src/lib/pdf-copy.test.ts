import { describe, expect, it } from "vitest";
import { getPdfCopy, PDF_LOCALES, type PdfLocale } from "./pdf-copy";

const expected = {
  cs: {
    reportTitle: "Report podle adresy",
    excellent: "Výborná lokalita pro bydlení",
    schools: "Základní školy",
    detail: "Srovnání s průměrem města",
    environment: "PROSTŘEDÍ A RIZIKA",
    accessibility: "Kam se dostanete za 10 minut",
    unavailable: "Nedostupné",
    footer: "kamvcesku.cz  ·  hodnocení na základě otevřených dat",
  },
  en: {
    reportTitle: "Address report",
    excellent: "Excellent place to live",
    schools: "Primary schools",
    detail: "Comparison with the city average",
    environment: "ENVIRONMENT AND RISKS",
    accessibility: "Where you can get in 10 minutes",
    unavailable: "Unavailable",
    footer: "kamvcesku.cz  ·  assessment based on open data",
  },
  ru: {
    reportTitle: "Отчёт по адресу",
    excellent: "Отличное место для жизни",
    schools: "Начальные школы",
    detail: "Сравнение со средним по городу",
    environment: "СРЕДА И РИСКИ",
    accessibility: "Куда можно добраться за 10 минут",
    unavailable: "Недоступно",
    footer: "kamvcesku.cz  ·  оценка на основе открытых данных",
  },
} as const satisfies Record<PdfLocale, Record<string, string>>;

describe("PDF report copy", () => {
  it("provides localized copy for every supported locale", () => {
    expect(PDF_LOCALES).toEqual(["cs", "en", "ru"]);

    for (const locale of PDF_LOCALES) {
      const copy = getPdfCopy(locale);
      expect(copy.reportTitle).toBe(expected[locale].reportTitle);
      expect(copy.verdict(0.8)).toBe(expected[locale].excellent);
      expect(copy.layers.schools).toBe(expected[locale].schools);
      expect(copy.cityComparisonTitle).toBe(expected[locale].detail);
      expect(copy.environment.heading).toBe(expected[locale].environment);
      expect(copy.accessibility.title).toBe(expected[locale].accessibility);
      expect(copy.unavailable).toBe(expected[locale].unavailable);
      expect(copy.footer).toBe(expected[locale].footer);
    }
  });

  it("localizes dynamic metrics, rent comparison, flood, and accessibility copy", () => {
    const en = getPdfCopy("en");
    expect(en.metric("quiet", 0)).toBe("quiet zone");
    expect(en.metric("safety", 12)).toBe("12 incidents/year");
    expect(en.metric("schools", 3)).toBe("3 within 800 m");
    expect(en.rent.headline(320)).toBe("Rent nearby:  ≈ CZK 320/m²/month");
    expect(en.rent.comparison(8, "Prague")).toBe("8% above the median · Prague");
    expect(en.environment.floodLevel[4]).toBe("very high");
    expect(en.distance(120)).toBe("120 m");
    expect(en.environment.noiseLevels(55, 45)).toBe("55 / 45 dB");
    expect(en.accessibility.reachableArea(12.5)).toBe("≈ 12.5 km² reachable");

    const ru = getPdfCopy("ru");
    expect(ru.metric("quiet", 0)).toBe("тихая зона");
    expect(ru.rent.comparison(-8, "Прага")).toBe("на 8% ниже медианы · Прага");
    expect(ru.distance(120)).toBe("120 м");
    expect(ru.environment.noiseLevels(55, 45)).toBe("55 / 45 дБ");
    expect(ru.environment.floodCategory(3)).toBe("(кат. 3/4)");
    expect(ru.accessibility.walk).toBe("10 минут пешком");
  });

  it("falls back to Czech for an absent locale", () => {
    expect(getPdfCopy(undefined).reportTitle).toBe(expected.cs.reportTitle);
  });

  it("credits the PDF basemap providers explicitly", () => {
    for (const locale of PDF_LOCALES) {
      const sources = getPdfCopy(locale).sources.base.join(" ");
      expect(sources).toContain("Esri");
      expect(sources).toContain("HERE");
      expect(sources).toContain("OpenStreetMap");
    }
  });

  it("contains localized labels and explanatory copy for every PDF section", () => {
    for (const locale of PDF_LOCALES) {
      const copy = getPdfCopy(locale);
      expect(Object.keys(copy.layers)).toHaveLength(13);
      expect(copy.groups).toHaveLength(6);
      expect(Object.keys(copy.nearbyLabels)).toHaveLength(6);
      expect(Object.keys(copy.flags)).toHaveLength(5);
      expect(copy.sources.base).toHaveLength(8);
      expect(copy.methodology).toHaveLength(2);
      expect(copy.environment.floodLevel).toHaveLength(5);

      const required = [
        copy.brand, copy.generated("1/1/2026"), copy.map.addressArea,
        copy.overallScore(), copy.strengths, copy.weaknesses,
        copy.prosHeading, copy.risksHeading, copy.noRisks, copy.noRisksDetail,
        copy.detailHeading, copy.addressLegend, copy.cityAverageLegend,
        copy.environment.noise, copy.environment.floodRisk, copy.environment.floodScope,
        copy.sources.heading, copy.sources.rent("2026 Q1"), copy.sources.flood,
        ...copy.methodology, copy.accessibility.heading, copy.accessibility.scope,
        copy.accessibility.drive, copy.accessibility.isochroneNote, copy.partialWarning,
      ];
      expect(required.every((value) => value.trim().length > 0)).toBe(true);
    }
  });
});
