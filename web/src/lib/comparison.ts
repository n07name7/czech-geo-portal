import { calculateProfileScore, type ReportProfileId } from "./report-insights";

export function compareAddresses({
  a,
  b,
  profile,
  locale,
}: {
  a: Record<string, number>;
  b: Record<string, number>;
  profile: ReportProfileId;
  locale: "cs" | "en";
}) {
  const aScore = Math.round(calculateProfileScore(a, profile) * 100);
  const bScore = Math.round(calculateProfileScore(b, profile) * 100);
  const delta = Math.abs(aScore - bScore);
  if (delta <= 3) {
    return {
      a: aScore,
      b: bScore,
      winner: "tie" as const,
      reason: locale === "cs"
        ? "Výsledky jsou velmi blízko — porovnejte konkrétní silné stránky a rizika obou adres."
        : "The results are very close — compare the concrete strengths and risks of both addresses.",
    };
  }
  const winner = aScore > bScore ? "a" as const : "b" as const;
  const winningScore = winner === "a" ? aScore : bScore;
  const profileName: Record<ReportProfileId, [string, string]> = {
    balanced: ["bydlení obecně", "living overall"],
    family: ["rodinu", "a family"],
    renter: ["nájem", "renting"],
    student: ["studenta", "a student"],
  };
  const noun = profileName[profile][locale === "cs" ? 0 : 1];
  return {
    a: aScore,
    b: bScore,
    winner,
    reason: locale === "cs"
      ? `Adresa ${winner === "a" ? "A" : "B"} je podle zvolených priorit silnější volba pro ${noun} (${winningScore}/100).`
      : `Address ${winner === "a" ? "A" : "B"} is the stronger choice for ${noun} based on the selected priorities (${winningScore}/100).`,
  };
}
