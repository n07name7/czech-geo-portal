export type ReportProfileId = "balanced" | "family" | "renter" | "student";
export type ReportLocale = "cs" | "en" | "ru";

type Scores = Record<string, number>;
type Nearby = Record<string, { name: string; dist: number; min: number }>;
type Flags = Record<string, { dist: number }>;

export const PROFILE_IDS: ReportProfileId[] = ["balanced", "family", "renter", "student"];

const LAYERS = [
  "schools", "kindergartens", "playgrounds", "clinics", "pharmacies", "transport",
  "parks", "sports", "shops", "quiet", "safety", "highschool", "air",
] as const;

const WEIGHTS: Record<ReportProfileId, Partial<Record<(typeof LAYERS)[number], number>>> = {
  balanced: {},
  family: {
    schools: 4, kindergartens: 4, playgrounds: 3, parks: 2.5, clinics: 2.5,
    safety: 2.5, quiet: 1.5, transport: 0.75, shops: 1, air: 1.5,
  },
  renter: {
    transport: 3, shops: 2, safety: 2, quiet: 1.75, parks: 1.25,
    pharmacies: 1.25, clinics: 1.25, air: 1.25, schools: 0.5, kindergartens: 0.5,
  },
  student: {
    transport: 3, shops: 2, sports: 1.75, parks: 1.5, safety: 1.5,
    quiet: 1.25, pharmacies: 1.25, clinics: 1.25, schools: 0.4, kindergartens: 0.4,
  },
};

const LABELS: Record<ReportLocale, Record<string, string>> = {
  cs: {
    schools: "školy", kindergartens: "školky", playgrounds: "dětská hřiště", clinics: "lékaři",
    pharmacies: "lékárny", transport: "MHD", parks: "parky", sports: "sportoviště", shops: "obchody",
    quiet: "klid", safety: "bezpečnost", highschool: "kvalita SŠ", air: "ovzduší",
  },
  en: {
    schools: "primary schools", kindergartens: "kindergartens", playgrounds: "playgrounds", clinics: "doctors",
    pharmacies: "pharmacies", transport: "public transport", parks: "parks", sports: "sports facilities", shops: "grocery shops",
    quiet: "quiet", safety: "safety", highschool: "school quality", air: "air quality",
  },
  ru: {
    schools: "начальные школы", kindergartens: "детские сады", playgrounds: "детские площадки", clinics: "врачи",
    pharmacies: "аптеки", transport: "общественный транспорт", parks: "парки", sports: "спортивные объекты", shops: "продуктовые магазины",
    quiet: "тишина", safety: "безопасность", highschool: "качество школ", air: "качество воздуха",
  },
};

const COPY = {
  cs: {
    notEnough: "Pro doporučení zatím nemáme dostatek dat.",
    strength: (label: string) => `Silná stránka: ${label}.`,
    weakness: (label: string) => `Slabší místo: ${label}.`,
    walk: (name: string, min: number) => `${name}: přibližně ${min} min podle vzdálenosti vzdušnou čarou.`,
    rentBelow: (n: number) => `Nájemné je o ${n} % pod mediánem města.`,
    rentAbove: (n: number) => `Nájemné je o ${n} % nad mediánem města.`,
    risk: (label: string, dist: number) => `${label} je přibližně ${dist} m od adresy.`,
    riskLabels: { road: "Rušná silnice", railway: "Železnice", gambling: "Herna / sázení", nightclub: "Noční klub", industrial: "Průmyslová zóna" },
    profile: { balanced: "bydlení", family: "rodinu", renter: "nájem", student: "studenta" },
    verdict: (score: number, noun: string) => score >= 0.7
      ? `Tato lokalita je silná volba pro ${noun}.`
      : score >= 0.5
        ? `Pro ${noun} je to rozumná volba, ale porovnejte ji ještě s další adresou.`
        : `Pro ${noun} doporučujeme porovnat klidnější nebo lépe vybavenou alternativu.`,
  },
  en: {
    notEnough: "There is not enough data for a recommendation yet.",
    strength: (label: string) => `A strength: ${label}.`,
    weakness: (label: string) => `A weaker point: ${label}.`,
    walk: (name: string, min: number) => `${name}: roughly ${min} minutes by straight-line distance.`,
    rentBelow: (n: number) => `Local rent is ${n}% below the city median.`,
    rentAbove: (n: number) => `Local rent is ${n}% above the city median.`,
    risk: (label: string, dist: number) => `${label} is approximately ${dist} m from the address.`,
    riskLabels: { road: "Busy road", railway: "Railway", gambling: "Gambling venue", nightclub: "Nightclub", industrial: "Industrial area" },
    profile: { balanced: "living here", family: "a family", renter: "renting", student: "a student" },
    verdict: (score: number, noun: string) => score >= 0.7
      ? `This is a strong choice for ${noun}.`
      : score >= 0.5
        ? `This is a reasonable choice for ${noun}, but compare it with another address.`
        : `For ${noun}, we recommend comparing a quieter or better-equipped alternative.`,
  },
  ru: {
    notEnough: "Для рекомендации пока недостаточно данных.",
    strength: (label: string) => `Сильная сторона: ${label}.`,
    weakness: (label: string) => `Слабое место: ${label}.`,
    walk: (name: string, min: number) => `${name}: примерно ${min} мин по расстоянию по прямой.`,
    rentBelow: (n: number) => `Аренда на ${n}% ниже медианы по городу.`,
    rentAbove: (n: number) => `Аренда на ${n}% выше медианы по городу.`,
    risk: (label: string, dist: number) => `${label} находится примерно в ${dist} м от адреса.`,
    riskLabels: { road: "Оживлённая дорога", railway: "Железная дорога", gambling: "Игорное заведение", nightclub: "Ночной клуб", industrial: "Промышленная зона" },
    profile: { balanced: "жизни в целом", family: "семьи", renter: "аренды", student: "студента" },
    verdict: (score: number, noun: string) => score >= 0.7
      ? `Этот район - сильный вариант для ${noun}.`
      : score >= 0.5
        ? `Это разумный вариант для ${noun}, но сравните его ещё с одним адресом.`
        : `Для ${noun} рекомендуем сравнить этот адрес с более тихой или лучше оснащённой альтернативой.`,
  },
} satisfies Record<ReportLocale, unknown>;

function value(scores: Scores, key: string): number | null {
  const raw = scores[key];
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : null;
}

export function calculateProfileScore(scores: Scores, profile: ReportProfileId): number {
  let numerator = 0;
  let denominator = 0;
  for (const layer of LAYERS) {
    const score = value(scores, layer);
    if (score == null) continue;
    const weight = WEIGHTS[profile][layer] ?? 1;
    numerator += score * weight;
    denominator += weight;
  }
  return denominator ? numerator / denominator : 0;
}

export function buildDecisionSummary({ scores, profile, nearby, flags, rent, rentCity, locale }: {
  scores: Scores;
  profile: ReportProfileId;
  nearby?: Nearby | null;
  flags?: Flags | null;
  rent?: number | null;
  rentCity?: number | null;
  locale: ReportLocale;
}) {
  const score = calculateProfileScore(scores, profile);
  const present = LAYERS.filter((id) => value(scores, id) != null);
  const copy = COPY[locale];
  if (present.length === 0) {
    return { profileScore: 0, strengths: [] as string[], watchOuts: [] as string[], verdict: copy.notEnough };
  }

  const labels = LABELS[locale];
  const strengths: string[] = [];
  const watchOuts: string[] = [];
  const ranked = present.map((id) => ({ id, score: value(scores, id) ?? 0 })).sort((a, b) => b.score - a.score);

  for (const item of ranked.slice(0, 2)) if (item.score >= 0.6) strengths.push(copy.strength(labels[item.id]));
  for (const item of ranked.slice(-2).reverse()) if (item.score <= 0.4) watchOuts.push(copy.weakness(labels[item.id]));

  if (nearby?.school && profile === "family") strengths.unshift(copy.walk(nearby.school.name, nearby.school.min));
  if (nearby?.park && (profile === "family" || profile === "student")) strengths.push(copy.walk(nearby.park.name, nearby.park.min));
  if (typeof rent === "number" && typeof rentCity === "number" && rentCity > 0) {
    const diff = Math.round(((rent - rentCity) / rentCity) * 100);
    if (diff <= -8) strengths.push(copy.rentBelow(Math.abs(diff)));
    if (diff >= 12) watchOuts.push(copy.rentAbove(diff));
  }

  const nearestRisk = Object.entries(flags ?? {})
    .filter(([key]) => key in copy.riskLabels)
    .sort(([, a], [, b]) => a.dist - b.dist)[0];
  if (nearestRisk) {
    const [kind, data] = nearestRisk;
    const label = copy.riskLabels[kind as keyof typeof copy.riskLabels];
    watchOuts.unshift(copy.risk(label, data.dist));
  }

  const noun = copy.profile[profile];
  return {
    profileScore: Math.round(score * 100),
    strengths: strengths.slice(0, 3),
    watchOuts: watchOuts.slice(0, 3),
    verdict: copy.verdict(score, noun),
  };
}
