export type MethodologyLocale = "cs" | "en" | "ru";

export type MethodologySource = {
  id: string;
  layer: string;
  source: string;
  period: string;
};

type MethodologyContent = {
  eyebrow: string;
  columns: [string, string, string];
  steps: string[];
  technicalNote: string;
  limitsTitle: string;
  limits: string;
  sources: MethodologySource[];
};

const sourceNames = [
  ["schools", "Základní školy", "Primary schools", "Начальные школы", "Rejstřík škol MŠMT + RÚIAN (ČÚZK)", "Latest ETL snapshot; extraction date is not recorded", "Последний ETL-снимок; дата выгрузки не сохранена"],
  ["kindergartens", "Mateřské školy", "Kindergartens", "Детские сады", "Rejstřík škol MŠMT + RÚIAN (ČÚZK)", "Latest ETL snapshot; extraction date is not recorded", "Последний ETL-снимок; дата выгрузки не сохранена"],
  ["playgrounds", "Dětská hřiště", "Playgrounds", "Детские площадки", "OpenStreetMap (ODbL)", "Latest ETL snapshot; extraction date is not recorded", "Последний ETL-снимок; дата выгрузки не сохранена"],
  ["clinics", "Lékaři / kliniky", "Doctors / clinics", "Врачи / клиники", "NRPZS / ÚZIS ČR (CC BY 4.0)", "Latest ETL snapshot; extraction date is not recorded", "Последний ETL-снимок; дата выгрузки не сохранена"],
  ["pharmacies", "Lékárny", "Pharmacies", "Аптеки", "NRPZS / ÚZIS ČR (CC BY 4.0)", "Latest ETL snapshot; extraction date is not recorded", "Последний ETL-снимок; дата выгрузки не сохранена"],
  ["transport", "Zastávky MHD", "Public transport stops", "Остановки транспорта", "OpenStreetMap (ODbL)", "Latest ETL snapshot; extraction date is not recorded", "Последний ETL-снимок; дата выгрузки не сохранена"],
  ["parks", "Parky", "Parks", "Парки", "OpenStreetMap (ODbL)", "Latest ETL snapshot; extraction date is not recorded", "Последний ETL-снимок; дата выгрузки не сохранена"],
  ["sports", "Sportoviště", "Sports facilities", "Спортивные объекты", "OpenStreetMap (ODbL)", "Latest ETL snapshot; extraction date is not recorded", "Последний ETL-снимок; дата выгрузки не сохранена"],
  ["shops", "Obchody s potravinami", "Grocery shops", "Продуктовые магазины", "OpenStreetMap (ODbL)", "Latest ETL snapshot; extraction date is not recorded", "Последний ETL-снимок; дата выгрузки не сохранена"],
  ["noise", "Klid / hluk", "Quiet / noise", "Тишина / шум", "Strategické hlukové mapy, MZ ČR", "Strategic noise maps 2022", "Стратегические карты шума, 2022"],
  ["safety", "Bezpečnost", "Safety signal", "Сигнал безопасности", "Mapa kriminality, Policie ČR", "Rolling 12-month incident snapshot", "Снимок происшествий за 12 месяцев"],
  ["highschool", "Kvalita SŠ", "Secondary-school quality", "Качество средних школ", "CERMAT + Rejstřík škol MŠMT", "Latest available annual results", "Последние доступные годовые результаты"],
  ["air", "Kvalita ovzduší", "Air quality", "Качество воздуха", "ČHMÚ, PM2.5 (1×1 km)", "Five-year average 2019-2023", "Среднее за 2019-2023 годы"],
  ["rent", "Nájemné", "Rent", "Аренда", "Cenová mapa nájemního bydlení, MF ČR", "Latest available quarterly release", "Последний доступный квартальный выпуск"],
  ["flood", "Povodňové riziko", "Flood risk", "Риск наводнения", "CENIA (směrnice 2007/60/ES)", "Flood-hazard dataset 2019", "Данные об угрозе наводнений, 2019"],
  ["reach", "Dostupnost", "Travel reach", "Транспортная доступность", "OpenStreetMap / Valhalla", "Live route calculation; network data may lag", "Расчёт маршрута онлайн; дорожные данные могут запаздывать"],
  ["nearby", "Okolí a upozornění", "Nearby places and watch-outs", "Объекты и факторы рядом", "OpenStreetMap (ODbL)", "Live lookup from the current OSM database", "Онлайн-поиск по актуальной базе OSM"],
] as const;

const periodCs: Record<string, string> = {
  schools: "Poslední ETL snímek; datum stažení není zaznamenáno", kindergartens: "Poslední ETL snímek; datum stažení není zaznamenáno", playgrounds: "Poslední ETL snímek; datum stažení není zaznamenáno",
  clinics: "Poslední ETL snímek; datum stažení není zaznamenáno", pharmacies: "Poslední ETL snímek; datum stažení není zaznamenáno", transport: "Poslední ETL snímek; datum stažení není zaznamenáno",
  parks: "Poslední ETL snímek; datum stažení není zaznamenáno", sports: "Poslední ETL snímek; datum stažení není zaznamenáno", shops: "Poslední ETL snímek; datum stažení není zaznamenáno",
  noise: "Strategické hlukové mapy 2022", safety: "Průběžných posledních 12 měsíců",
  highschool: "Poslední dostupné roční výsledky", air: "Pětiletý průměr 2019-2023",
  rent: "Poslední dostupné čtvrtletní vydání", flood: "Data povodňového ohrožení 2019",
  reach: "Živý výpočet; silniční síť může mít zpoždění", nearby: "Živý dotaz nad aktuální databází OSM",
};

export function getMethodologyContent(locale: string): MethodologyContent {
  const lang: MethodologyLocale = locale === "ru" ? "ru" : locale === "en" ? "en" : "cs";
  const index = lang === "cs" ? 1 : lang === "en" ? 2 : 3;
  const sources = sourceNames.map(([id, cs, en, ru, source, enPeriod, ruPeriod]) => ({
    id,
    layer: [cs, en, ru][index - 1],
    source,
    period: lang === "cs" ? periodCs[id] : lang === "en" ? enPeriod : ruPeriod,
  }));

  if (lang === "ru") return {
    eyebrow: "Документация", columns: ["Показатель", "Источник", "Период данных"],
    steps: ["Ячейки H3 (~150 м)", "Расчёт показателя", "Нормализация внутри города", "Цвет на карте"],
    technicalNote: "Базовое разрешение H3 10 (ячейка около 150 × 150 м); при удалении карта объединяет ячейки. Для большинства объектов используется радиус 800 м.",
    limitsTitle: "Как интерпретировать результат",
    limits: "Оценка сравнивает окружение адреса с другими ячейками того же города. Это не официальный документ, не проверка самой недвижимости и не гарантия личной безопасности или отсутствия риска. Показатель безопасности отражает относительную плотность зарегистрированных происшествий без поправки на поток людей и тяжесть случаев. Данные могут быть неполными или устаревать.",
    sources,
  };
  if (lang === "en") return {
    eyebrow: "Documentation", columns: ["Indicator", "Source", "Data period"],
    steps: ["H3 cells (~150 m)", "Indicator score", "Within-city normalization", "Map colour"],
    technicalNote: "Base H3 resolution 10 (about 150 × 150 m per cell); cells are aggregated when zooming out. Most amenity counts use an 800 m radius.",
    limitsTitle: "How to interpret the result",
    limits: "The score compares an address's surroundings with other cells in the same city. It is not an official document, a property inspection, or a guarantee of personal safety or absence of risk. The safety signal is relative incident density and does not adjust for footfall or incident severity. Sources can be incomplete or become outdated.",
    sources,
  };
  return {
    eyebrow: "Dokumentace", columns: ["Ukazatel", "Zdroj", "Období dat"],
    steps: ["Buňky H3 (~150 m)", "Skóre ukazatele", "Normalizace v rámci města", "Barva na mapě"],
    technicalNote: "Základní rozlišení H3 10 (buňka přibližně 150 × 150 m); při oddálení se buňky slučují. U většiny objektů používáme okruh 800 m.",
    limitsTitle: "Jak výsledek interpretovat",
    limits: "Skóre porovnává okolí adresy s ostatními buňkami téhož města. Nejde o úřední dokument, kontrolu samotné nemovitosti ani není zárukou osobní bezpečnosti či nepřítomnosti rizika. Bezpečnost vyjadřuje relativní hustotu evidovaných incidentů bez zohlednění pohybu osob a závažnosti případů. Zdroje mohou být neúplné nebo zastarat.",
    sources,
  };
}
