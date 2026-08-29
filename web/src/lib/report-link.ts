export type ReportPlace = { label: string; lat: number; lon: number };

export function buildReportHref(locale: string, place?: ReportPlace): string {
  const base = `/${locale}/report`;
  if (!place) return base;
  const params = new URLSearchParams({
    address: place.label,
    lat: String(place.lat),
    lon: String(place.lon),
  });
  return `${base}?${params.toString()}`;
}
