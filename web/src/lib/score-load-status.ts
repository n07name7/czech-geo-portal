export type ScoreLoadStatus = "idle" | "loading" | "ready" | "outside" | "unavailable";

export function scoreStatusMessageKey(
  status: ScoreLoadStatus,
): "scoreLoading" | "scoreOutside" | "scoreUnavailable" | null {
  if (status === "loading") return "scoreLoading";
  if (status === "outside") return "scoreOutside";
  if (status === "unavailable") return "scoreUnavailable";
  return null;
}
