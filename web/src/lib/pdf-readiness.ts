export type PdfSource = "nearby" | "flood" | "flags" | "averages" | "map" | "isoWalk" | "isoDrive";
export type SourceStatus = "loading" | "ready" | "unavailable";
export type PdfSourceStatus = Record<PdfSource, SourceStatus>;
export type PdfReadiness = "loading" | "ready" | "partial";

export const INITIAL_PDF_SOURCE_STATUS: PdfSourceStatus = {
  nearby: "loading",
  flood: "loading",
  flags: "loading",
  averages: "loading",
  map: "loading",
  isoWalk: "loading",
  isoDrive: "loading",
};

export function pdfReadiness(status: PdfSourceStatus): PdfReadiness {
  const values = Object.values(status);
  if (values.includes("loading")) return "loading";
  if (values.includes("unavailable")) return "partial";
  return "ready";
}
