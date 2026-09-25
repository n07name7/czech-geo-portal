import { calculateProfileScore, type ReportProfileId, type ReportLocale } from "./report-insights";

const COPY: Record<ReportLocale, {
  close: string;
  incomparable: string;
  prefix: string;
  stronger: (winner: "a" | "b", noun: string, score: number) => string;
  profile: Record<ReportProfileId, string>;
}> = {
  cs: {
    close: "Výsledky jsou velmi blízko - porovnejte konkrétní silné stránky a rizika obou adres.",
    incomparable: "Adresy jsou v různých městech. Skóre ukazují pozici každé lokality v rámci jejího města, proto neurčujeme absolutního vítěze.",
    prefix: "Adresa",
    stronger: (winner, noun, score) => `Adresa ${winner.toUpperCase()} je podle zvolených priorit silnější volba pro ${noun} (${score}/100).`,
    profile: { balanced: "bydlení obecně", family: "rodinu", renter: "nájem", student: "studenta" },
  },
  en: {
    close: "The results are very close - compare the concrete strengths and risks of both addresses.",
    incomparable: "The addresses are in different cities. Each score shows the location's position within its own city, so no absolute winner is declared.",
    prefix: "Address",
    stronger: (winner, noun, score) => `Address ${winner.toUpperCase()} is the stronger choice for ${noun} based on the selected priorities (${score}/100).`,
    profile: { balanced: "living overall", family: "a family", renter: "renting", student: "a student" },
  },
  ru: {
    close: "Результаты почти одинаковы - сравните конкретные преимущества и риски обоих адресов.",
    incomparable: "Адреса находятся в разных городах. Каждый балл показывает позицию района внутри своего города, поэтому абсолютного победителя нет.",
    prefix: "Адрес",
    stronger: (winner, noun, score) => `Адрес ${winner.toUpperCase()} лучше соответствует выбранным приоритетам для ${noun} (${score}/100).`,
    profile: { balanced: "жизни в целом", family: "семьи", renter: "аренды", student: "студента" },
  },
};

export function compareAddresses({
  a,
  b,
  profile,
  locale,
  comparable = true,
}: {
  a: Record<string, number>;
  b: Record<string, number>;
  profile: ReportProfileId;
  locale: ReportLocale;
  comparable?: boolean;
}) {
  const aScore = Math.round(calculateProfileScore(a, profile) * 100);
  const bScore = Math.round(calculateProfileScore(b, profile) * 100);
  const delta = Math.abs(aScore - bScore);
  const copy = COPY[locale];
  if (!comparable) {
    return { a: aScore, b: bScore, winner: "incomparable" as const, reason: copy.incomparable };
  }
  if (delta <= 3) {
    return { a: aScore, b: bScore, winner: "tie" as const, reason: copy.close };
  }
  const winner = aScore > bScore ? "a" as const : "b" as const;
  const winningScore = winner === "a" ? aScore : bScore;
  return {
    a: aScore,
    b: bScore,
    winner,
    reason: copy.stronger(winner, copy.profile[profile], winningScore),
  };
}
