export type ComparisonDetailId = "rent" | "transport" | "safety" | "quiet" | "schools" | "shops" | "air";
export type ComparisonWinner = "a" | "b" | "tie" | "incomparable";

export type ComparisonDetail = {
  id: ComparisonDetailId;
  a: number;
  b: number;
  difference: number;
  winner: ComparisonWinner;
  kind: "rent" | "score";
};

const SCORE_IDS: ComparisonDetailId[] = ["transport", "safety", "quiet", "schools", "shops", "air"];

export function buildComparisonDetails({ a, b, comparable = true }: {
  a: Record<string, number>;
  b: Record<string, number>;
  comparable?: boolean;
}): ComparisonDetail[] {
  const rows: ComparisonDetail[] = [];
  const rentA = a.rent;
  const rentB = b.rent;
  if (Number.isFinite(rentA) && Number.isFinite(rentB) && rentA > 0 && rentB > 0) {
    const difference = Math.abs(Math.round(rentA) - Math.round(rentB));
    rows.push({
      id: "rent",
      a: Math.round(rentA),
      b: Math.round(rentB),
      difference,
      winner: !comparable ? "incomparable" : difference < 5 ? "tie" : rentA < rentB ? "a" : "b",
      kind: "rent",
    });
  }

  for (const id of SCORE_IDS) {
    const aValue = a[id];
    const bValue = b[id];
    if (!Number.isFinite(aValue) || !Number.isFinite(bValue)) continue;
    const aPercent = Math.round(aValue * 100);
    const bPercent = Math.round(bValue * 100);
    const difference = Math.abs(aPercent - bPercent);
    rows.push({
      id,
      a: aPercent,
      b: bPercent,
      difference,
      winner: !comparable ? "incomparable" : difference < 2 ? "tie" : aValue > bValue ? "a" : "b",
      kind: "score",
    });
  }
  return rows;
}
