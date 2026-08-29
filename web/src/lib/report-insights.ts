export type ReportProfileId = "balanced" | "family" | "renter" | "student";
export type ReportLocale = "cs" | "en";

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
};

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

export function buildDecisionSummary({
  scores,
  profile,
  nearby,
  flags,
  rent,
  rentCity,
  locale,
}: {
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
  if (present.length === 0) {
    return {
      profileScore: 0,
      strengths: [] as string[],
      watchOuts: [] as string[],
      verdict: locale === "cs"
        ? "Pro doporučení zatím nemáme dostatek dat."
        : "There is not enough data for a recommendation yet.",
    };
  }

  const labels = LABELS[locale];
  const strengths: string[] = [];
  const watchOuts: string[] = [];
  const ranked = present
    .map((id) => ({ id, score: value(scores, id) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  for (const item of ranked.slice(0, 2)) {
    if (item.score >= 0.6) {
      strengths.push(locale === "cs"
        ? `Silná stránka: ${labels[item.id]}.`
        : `A strength: ${labels[item.id]}.`);
    }
  }
  for (const item of ranked.slice(-2).reverse()) {
    if (item.score <= 0.4) {
      watchOuts.push(locale === "cs"
        ? `Slabší místo: ${labels[item.id]}.`
        : `A weaker point: ${labels[item.id]}.`);
    }
  }

  if (nearby?.school && profile === "family") {
    strengths.unshift(locale === "cs"
      ? `${nearby.school.name} je ${nearby.school.min} min pěšky.`
      : `${nearby.school.name} is a ${nearby.school.min}-minute walk.`);
  }
  if (nearby?.park && (profile === "family" || profile === "student")) {
    strengths.push(locale === "cs"
      ? `${nearby.park.name} je ${nearby.park.min} min pěšky.`
      : `${nearby.park.name} is a ${nearby.park.min}-minute walk.`);
  }
  if (typeof rent === "number" && typeof rentCity === "number" && rentCity > 0) {
    const diff = Math.round(((rent - rentCity) / rentCity) * 100);
    if (diff <= -8) strengths.push(locale === "cs"
      ? `Nájemné je o ${Math.abs(diff)} % pod mediánem města.`
      : `Local rent is ${Math.abs(diff)}% below the city median.`);
    if (diff >= 12) watchOuts.push(locale === "cs"
      ? `Nájemné je o ${diff} % nad mediánem města.`
      : `Local rent is ${diff}% above the city median.`);
  }

  const riskLabels: Record<string, [string, string]> = {
    road: ["Rušná silnice", "Busy road"],
    railway: ["Železnice", "Railway"],
    gambling: ["Herna / sázení", "Gambling venue"],
    nightclub: ["Noční klub", "Nightclub"],
    industrial: ["Průmyslová zóna", "Industrial area"],
  };
  const nearestRisk = Object.entries(flags ?? {})
    .filter(([key]) => key in riskLabels)
    .sort(([, a], [, b]) => a.dist - b.dist)[0];
  if (nearestRisk) {
    const [kind, data] = nearestRisk;
    const label = riskLabels[kind][locale === "cs" ? 0 : 1];
    watchOuts.unshift(locale === "cs"
      ? `${label} je přibližně ${data.dist} m od adresy.`
      : `${label} is approximately ${data.dist} m from the address.`);
  }

  const profileNoun: Record<ReportProfileId, [string, string]> = {
    balanced: ["bydlení", "living here"],
    family: ["rodinu", "a family"],
    renter: ["nájem", "renting"],
    student: ["studenta", "a student"],
  };
  const noun = profileNoun[profile][locale === "cs" ? 0 : 1];
  const verdict = locale === "cs"
    ? score >= 0.7
      ? `Tato lokalita je silná volba pro ${noun}.`
      : score >= 0.5
        ? `Pro ${noun} je to rozumná volba, ale porovnejte ji ještě s další adresou.`
        : `Pro ${noun} doporučujeme porovnat klidnější nebo lépe vybavenou alternativu.`
    : score >= 0.7
      ? `This is a strong choice for ${noun}.`
      : score >= 0.5
        ? `This is a reasonable choice for ${noun}, but compare it with another address.`
        : `For ${noun}, we recommend comparing a quieter or better-equipped alternative.`;

  return { profileScore: Math.round(score * 100), strengths: strengths.slice(0, 3), watchOuts: watchOuts.slice(0, 3), verdict };
}
