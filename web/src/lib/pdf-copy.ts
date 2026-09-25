export const PDF_LOCALES = ["cs", "en", "ru"] as const;
export type PdfLocale = typeof PDF_LOCALES[number];

export type PdfLayerId =
  | "schools" | "kindergartens" | "playgrounds" | "clinics" | "pharmacies"
  | "transport" | "parks" | "sports" | "shops" | "quiet" | "safety"
  | "highschool" | "air";

export type PdfNearbyId = "transit" | "supermarket" | "pharmacy" | "health" | "school" | "park";
export type PdfFlagId = "road" | "railway" | "gambling" | "nightclub" | "industrial";

type PdfGroup = { title: string; ids: readonly PdfLayerId[] };
type PdfFlagCopy = readonly [label: string, detail: string];

export type PdfCopy = {
  dateLocale: string;
  brand: string;
  reportTitle: string;
  generated: (date: string) => string;
  map: { worse: string; better: string; overallRating: string; addressArea: string };
  rent: {
    headline: (rent: number) => string;
    comparison: (difference: number, city?: string) => string;
  };
  scoreOutOf: string;
  verdict: (score: number) => string;
  overallScore: (city?: string) => string;
  layers: Record<PdfLayerId, string>;
  groups: readonly PdfGroup[];
  strengths: string;
  weaknesses: string;
  nearbyLabels: Record<PdfNearbyId, string>;
  flags: Record<PdfFlagId, PdfFlagCopy>;
  prosHeading: string;
  risksHeading: string;
  noRisks: string;
  noRisksDetail: string;
  footer: string;
  detailHeading: string;
  cityComparisonTitle: string;
  metric: (id: string, count: number) => string;
  addressLegend: string;
  cityAverageLegend: string;
  distance: (meters: number) => string;
  environment: {
    heading: string;
    noise: string;
    noiseLevels: (day: number | string, night: number | string) => string;
    floodRisk: string;
    floodLevel: readonly [string, string, string, string, string];
    floodCategory: (category: number) => string;
    floodScope: string;
  };
  sources: {
    heading: string;
    base: readonly string[];
    rent: (quarter?: string) => string;
    flood: string;
  };
  methodology: readonly [string, string];
  accessibility: {
    heading: string;
    title: string;
    scope: string;
    walk: string;
    drive: string;
    reachableArea: (area: number) => string;
    isochroneNote: string;
  };
  unavailable: string;
  partialWarning: string;
};

const citySuffix = (city?: string) => city ? ` · ${city}` : "";

const CATALOG = {
  cs: {
    dateLocale: "cs-CZ",
    brand: "KAM V ČESKU?",
    reportTitle: "Report podle adresy",
    generated: (date) => `Vygenerováno ${date}`,
    map: { worse: "hůř", better: "lépe", overallRating: "celkové hodnocení okolí", addressArea: "OKOLÍ ADRESY" },
    rent: {
      headline: (rent) => `Nájemné v okolí:  ≈ ${rent} Kč/m²/měs`,
      comparison: (difference, city) => difference === 0
        ? `stejně jako medián${citySuffix(city)}`
        : `o ${Math.abs(difference)} % ${difference > 0 ? "dráž" : "levněji"} než medián${citySuffix(city)}`,
    },
    scoreOutOf: "/ 100",
    verdict: (score) => score >= 0.65 ? "Výborná lokalita pro bydlení"
      : score >= 0.5 ? "Dobrá lokalita pro bydlení"
      : score >= 0.35 ? "Průměrná lokalita" : "Podprůměrná lokalita",
    overallScore: (city) => `Celkové skóre okolí${citySuffix(city)}`,
    layers: {
      schools: "Základní školy", kindergartens: "Mateřské školy", playgrounds: "Dětská hřiště",
      clinics: "Lékaři / kliniky", pharmacies: "Lékárny", transport: "Zastávky MHD", parks: "Parky",
      sports: "Sportoviště", shops: "Obchody", quiet: "Klid (hluk)", safety: "Bezpečnost",
      highschool: "Kvalita SŠ", air: "Kvalita ovzduší",
    },
    groups: [
      { title: "Doprava", ids: ["transport"] },
      { title: "Vzdělávání", ids: ["kindergartens", "schools", "highschool"] },
      { title: "Zdraví", ids: ["clinics", "pharmacies"] },
      { title: "Prostředí", ids: ["parks", "quiet", "air"] },
      { title: "Služby", ids: ["playgrounds", "sports", "shops"] },
      { title: "Bezpečnost", ids: ["safety"] },
    ],
    strengths: "SILNÉ STRÁNKY", weaknesses: "SLABÉ STRÁNKY",
    nearbyLabels: { transit: "MHD zastávka", supermarket: "Supermarket", pharmacy: "Lékárna", health: "Lékař / nemocnice", school: "Škola", park: "Park" },
    flags: {
      road: ["Rušná silnice", "doprava · hluk"], railway: ["Železnice", "hluk · vibrace"],
      gambling: ["Herna / sázení", "v okolí"], nightclub: ["Noční klub", "noční hluk"],
      industrial: ["Průmyslová zóna", "průmysl · doprava"],
    },
    prosHeading: "CO TU JE", risksHeading: "NA CO POZOR",
    noRisks: "Žádná zjevná rizika v okolí", noRisksDetail: "bez rušné silnice, železnice, heren…",
    footer: "kamvcesku.cz  ·  hodnocení na základě otevřených dat",
    detailHeading: "DETAILNÍ ROZBOR", cityComparisonTitle: "Srovnání s průměrem města",
    metric: (id, count) => id === "quiet" ? (count > 0 ? `${count} dB` : "tichá zóna")
      : id === "safety" ? `${count} případů/rok`
      : id === "highschool" ? (count > 0 ? `${count}. percentil` : "-")
      : id === "air" ? (count > 0 ? `${count} µg/m³` : "-") : `${count} do 800 m`,
    addressLegend: "vaše adresa", cityAverageLegend: "průměr města",
    distance: (meters) => `${meters} m`,
    environment: {
      heading: "PROSTŘEDÍ A RIZIKA", noise: "Hluk (den / noc)", floodRisk: "Povodňové riziko (řeky)",
      noiseLevels: (day, night) => `${day} / ${night} dB`,
      floodLevel: ["mimo záplavové území", "nízké", "střední", "vysoké", "velmi vysoké"],
      floodCategory: (category) => `(kat. ${category}/4)`,
      floodScope: "Týká se rozlivů řek; přívalové (bleskové) povodně z přívalových srážek nezahrnuje.",
    },
    sources: {
      heading: "ZDROJE DAT",
      base: [
        "Školy/školky: Rejstřík škol MŠMT + RÚIAN (ČÚZK)",
        "Lékaři, lékárny: NRPZS / ÚZIS ČR (CC BY 4.0)",
        "Klid (hluk): Strategické hlukové mapy 2022, MZ ČR",
        "Bezpečnost: Mapa kriminality, Policie ČR",
        "Kvalita SŠ: Přijímací zkoušky CERMAT",
        "Kvalita ovzduší: Pětileté průměry PM2.5, ČHMÚ",
        "Ostatní: OpenStreetMap (ODbL)",
        "Podkladová mapa: Esri, HERE, Garmin, OpenStreetMap contributors a GIS user community",
      ],
      rent: (quarter) => `Nájemné: MF ČR - cenová mapa nájemního bydlení${quarter ? ` (${quarter})` : ""}`,
      flood: "Povodňové riziko: CENIA - povodňové ohrožení 2019 (směrnice 2007/60/ES)",
    },
    methodology: [
      "Skóre 0-100 = relativní hodnocení v rámci města. Počty objektů do 800 m od adresy",
      "(kvalita SŠ do 3 km, ovzduší roční průměr PM2.5).",
    ],
    accessibility: {
      heading: "DOSTUPNOST", title: "Kam se dostanete za 10 minut",
      scope: "Dosah od adresy po reálné silniční síti (zdroj: OpenStreetMap / Valhalla).",
      walk: "10 minut pěšky", drive: "10 minut autem",
      reachableArea: (area) => `≈ ${area} km² dosažitelných`,
      isochroneNote: "Izochrona = oblast dosažitelná z adresy ve stanoveném čase. Bod = vaše adresa.",
    },
    unavailable: "Nedostupné",
    partialWarning: "Některá volitelná online data nebyla při generování dostupná. Příslušné sekce jsou vynechány; chybějící odpověď neznamená nepřítomnost rizika.",
  },
  en: {
    dateLocale: "en-GB",
    brand: "WHERE IN CZECHIA?",
    reportTitle: "Address report",
    generated: (date) => `Generated ${date}`,
    map: { worse: "worse", better: "better", overallRating: "overall neighborhood rating", addressArea: "ADDRESS AREA" },
    rent: {
      headline: (rent) => `Rent nearby:  ≈ CZK ${rent}/m²/month`,
      comparison: (difference, city) => difference === 0
        ? `same as the median${citySuffix(city)}`
        : `${Math.abs(difference)}% ${difference > 0 ? "above" : "below"} the median${citySuffix(city)}`,
    },
    scoreOutOf: "/ 100",
    verdict: (score) => score >= 0.65 ? "Excellent place to live"
      : score >= 0.5 ? "Good place to live"
      : score >= 0.35 ? "Average location" : "Below-average location",
    overallScore: (city) => `Overall neighborhood score${citySuffix(city)}`,
    layers: {
      schools: "Primary schools", kindergartens: "Kindergartens", playgrounds: "Playgrounds",
      clinics: "Doctors / clinics", pharmacies: "Pharmacies", transport: "Public transport stops", parks: "Parks",
      sports: "Sports facilities", shops: "Shops", quiet: "Quiet (noise)", safety: "Safety",
      highschool: "Secondary school quality", air: "Air quality",
    },
    groups: [
      { title: "Transport", ids: ["transport"] },
      { title: "Education", ids: ["kindergartens", "schools", "highschool"] },
      { title: "Health", ids: ["clinics", "pharmacies"] },
      { title: "Environment", ids: ["parks", "quiet", "air"] },
      { title: "Services", ids: ["playgrounds", "sports", "shops"] },
      { title: "Safety", ids: ["safety"] },
    ],
    strengths: "STRENGTHS", weaknesses: "WEAKNESSES",
    nearbyLabels: { transit: "Public transport stop", supermarket: "Supermarket", pharmacy: "Pharmacy", health: "Doctor / hospital", school: "School", park: "Park" },
    flags: {
      road: ["Busy road", "traffic · noise"], railway: ["Railway", "noise · vibrations"],
      gambling: ["Gambling venue", "nearby"], nightclub: ["Nightclub", "night noise"],
      industrial: ["Industrial zone", "industry · traffic"],
    },
    prosHeading: "WHAT IS NEARBY", risksHeading: "WHAT TO WATCH",
    noRisks: "No obvious risks nearby", noRisksDetail: "no busy road, railway, gambling venues…",
    footer: "kamvcesku.cz  ·  assessment based on open data",
    detailHeading: "DETAILED ANALYSIS", cityComparisonTitle: "Comparison with the city average",
    metric: (id, count) => id === "quiet" ? (count > 0 ? `${count} dB` : "quiet zone")
      : id === "safety" ? `${count} incidents/year`
      : id === "highschool" ? (count > 0 ? `${count}th percentile` : "-")
      : id === "air" ? (count > 0 ? `${count} µg/m³` : "-") : `${count} within 800 m`,
    addressLegend: "your address", cityAverageLegend: "city average",
    distance: (meters) => `${meters} m`,
    environment: {
      heading: "ENVIRONMENT AND RISKS", noise: "Noise (day / night)", floodRisk: "Flood risk (rivers)",
      noiseLevels: (day, night) => `${day} / ${night} dB`,
      floodLevel: ["outside flood hazard areas", "low", "medium", "high", "very high"],
      floodCategory: (category) => `(cat. ${category}/4)`,
      floodScope: "Covers river flooding only; flash floods caused by intense rainfall are not included.",
    },
    sources: {
      heading: "DATA SOURCES",
      base: [
        "Schools/kindergartens: MŠMT Register of Schools + RÚIAN (ČÚZK)",
        "Doctors, pharmacies: NRPZS / ÚZIS ČR (CC BY 4.0)",
        "Quiet (noise): Strategic Noise Maps 2022, MZ ČR",
        "Safety: Crime Map, Policie ČR",
        "Secondary school quality: CERMAT entrance examinations",
        "Air quality: Five-year PM2.5 averages, ČHMÚ",
        "Other: OpenStreetMap (ODbL)",
        "Basemap: Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS user community",
      ],
      rent: (quarter) => `Rent: MF ČR - rental housing price map${quarter ? ` (${quarter})` : ""}`,
      flood: "Flood risk: CENIA - flood hazard 2019 (Directive 2007/60/EC)",
    },
    methodology: [
      "Score 0-100 = relative rating within the city. Counts are for places within 800 m of the address",
      "(secondary school quality within 3 km; air quality is the annual PM2.5 average).",
    ],
    accessibility: {
      heading: "ACCESSIBILITY", title: "Where you can get in 10 minutes",
      scope: "Reach from the address via the real road network (source: OpenStreetMap / Valhalla).",
      walk: "10 minutes on foot", drive: "10 minutes by car",
      reachableArea: (area) => `≈ ${area} km² reachable`,
      isochroneNote: "Isochrone = area reachable from the address within the stated time. Dot = your address.",
    },
    unavailable: "Unavailable",
    partialWarning: "Some optional online data was unavailable during generation. The affected sections are omitted; a missing response does not mean there is no risk.",
  },
  ru: {
    dateLocale: "ru-RU",
    brand: "ГДЕ В ЧЕХИИ?",
    reportTitle: "Отчёт по адресу",
    generated: (date) => `Сформировано ${date}`,
    map: { worse: "хуже", better: "лучше", overallRating: "общая оценка района", addressArea: "ОКРЕСТНОСТИ АДРЕСА" },
    rent: {
      headline: (rent) => `Аренда рядом:  ≈ ${rent} Kč/м²/мес`,
      comparison: (difference, city) => difference === 0
        ? `на уровне медианы${citySuffix(city)}`
        : `на ${Math.abs(difference)}% ${difference > 0 ? "выше" : "ниже"} медианы${citySuffix(city)}`,
    },
    scoreOutOf: "/ 100",
    verdict: (score) => score >= 0.65 ? "Отличное место для жизни"
      : score >= 0.5 ? "Хорошее место для жизни"
      : score >= 0.35 ? "Средний район" : "Район ниже среднего",
    overallScore: (city) => `Общая оценка района${citySuffix(city)}`,
    layers: {
      schools: "Начальные школы", kindergartens: "Детские сады", playgrounds: "Детские площадки",
      clinics: "Врачи / клиники", pharmacies: "Аптеки", transport: "Остановки транспорта", parks: "Парки",
      sports: "Спортивные объекты", shops: "Магазины", quiet: "Тишина (шум)", safety: "Безопасность",
      highschool: "Качество средних школ", air: "Качество воздуха",
    },
    groups: [
      { title: "Транспорт", ids: ["transport"] },
      { title: "Образование", ids: ["kindergartens", "schools", "highschool"] },
      { title: "Здоровье", ids: ["clinics", "pharmacies"] },
      { title: "Среда", ids: ["parks", "quiet", "air"] },
      { title: "Услуги", ids: ["playgrounds", "sports", "shops"] },
      { title: "Безопасность", ids: ["safety"] },
    ],
    strengths: "СИЛЬНЫЕ СТОРОНЫ", weaknesses: "СЛАБЫЕ СТОРОНЫ",
    nearbyLabels: { transit: "Остановка транспорта", supermarket: "Супермаркет", pharmacy: "Аптека", health: "Врач / больница", school: "Школа", park: "Парк" },
    flags: {
      road: ["Оживлённая дорога", "транспорт · шум"], railway: ["Железная дорога", "шум · вибрации"],
      gambling: ["Игорное заведение", "поблизости"], nightclub: ["Ночной клуб", "ночной шум"],
      industrial: ["Промышленная зона", "промышленность · транспорт"],
    },
    prosHeading: "ЧТО ЕСТЬ РЯДОМ", risksHeading: "НА ЧТО ОБРАТИТЬ ВНИМАНИЕ",
    noRisks: "Очевидных рисков поблизости нет", noRisksDetail: "нет оживлённой дороги, железной дороги, игорных заведений…",
    footer: "kamvcesku.cz  ·  оценка на основе открытых данных",
    detailHeading: "ПОДРОБНЫЙ АНАЛИЗ", cityComparisonTitle: "Сравнение со средним по городу",
    metric: (id, count) => id === "quiet" ? (count > 0 ? `${count} дБ` : "тихая зона")
      : id === "safety" ? `${count} случаев/год`
      : id === "highschool" ? (count > 0 ? `${count}-й процентиль` : "-")
      : id === "air" ? (count > 0 ? `${count} мкг/м³` : "-") : `${count} в радиусе 800 м`,
    addressLegend: "ваш адрес", cityAverageLegend: "среднее по городу",
    distance: (meters) => `${meters} м`,
    environment: {
      heading: "СРЕДА И РИСКИ", noise: "Шум (день / ночь)", floodRisk: "Риск наводнения (реки)",
      noiseLevels: (day, night) => `${day} / ${night} дБ`,
      floodLevel: ["вне зоны затопления", "низкий", "средний", "высокий", "очень высокий"],
      floodCategory: (category) => `(кат. ${category}/4)`,
      floodScope: "Учитываются только разливы рек; внезапные паводки из-за сильных осадков не включены.",
    },
    sources: {
      heading: "ИСТОЧНИКИ ДАННЫХ",
      base: [
        "Школы/детские сады: Реестр школ MŠMT + RÚIAN (ČÚZK)",
        "Врачи, аптеки: NRPZS / ÚZIS ČR (CC BY 4.0)",
        "Тишина (шум): Стратегические карты шума 2022, MZ ČR",
        "Безопасность: Карта преступности, Policie ČR",
        "Качество средних школ: вступительные экзамены CERMAT",
        "Качество воздуха: средние значения PM2.5 за пять лет, ČHMÚ",
        "Прочее: OpenStreetMap (ODbL)",
        "Подложка карты: Esri, HERE, Garmin, участники OpenStreetMap и GIS user community",
      ],
      rent: (quarter) => `Аренда: MF ČR - карта цен на арендное жильё${quarter ? ` (${quarter})` : ""}`,
      flood: "Риск наводнения: CENIA - угроза наводнений 2019 (Директива 2007/60/EC)",
    },
    methodology: [
      "Оценка 0-100 = относительная оценка в пределах города. Объекты учитываются в радиусе 800 м",
      "(качество средних школ - до 3 км; воздух - среднегодовой уровень PM2.5).",
    ],
    accessibility: {
      heading: "ДОСТУПНОСТЬ", title: "Куда можно добраться за 10 минут",
      scope: "Зона доступности от адреса по реальной дорожной сети (источник: OpenStreetMap / Valhalla).",
      walk: "10 минут пешком", drive: "10 минут на машине",
      reachableArea: (area) => `≈ ${area} км² доступно`,
      isochroneNote: "Изохрона = область, доступная от адреса за указанное время. Точка = ваш адрес.",
    },
    unavailable: "Недоступно",
    partialWarning: "Часть дополнительных онлайн-данных была недоступна при создании отчёта. Соответствующие разделы пропущены; отсутствие ответа не означает отсутствие риска.",
  },
} satisfies Record<PdfLocale, PdfCopy>;

export function getPdfCopy(locale: string | null | undefined): PdfCopy {
  const normalized: PdfLocale = locale === "en" ? "en" : locale === "ru" ? "ru" : "cs";
  return CATALOG[normalized];
}
