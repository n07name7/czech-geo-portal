export type ReportPlace = { label: string; lat: number; lon: number };

export function parseReportCoordinates(params: URLSearchParams): { lat: number; lon: number } | null {
  const latValue = params.get("lat");
  const lonValue = params.get("lon");
  if (latValue === null || lonValue === null) return null;
  const lat = Number(latValue);
  const lon = Number(lonValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 48.5 || lat > 51.1 || lon < 12 || lon > 18.9) return null;
  return { lat, lon };
}

export function buildReportHref(locale: string, place?: ReportPlace): string {
  const base = `/${locale}/report`;
  if (!place) return base;
  const params = new URLSearchParams({
    lat: String(place.lat),
    lon: String(place.lon),
    address: place.label,
  });
  return `${base}?${params.toString()}`;
}
