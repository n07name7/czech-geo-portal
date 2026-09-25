const DATA_FILES = new Set([
  "schools.pmtiles", "kindergartens.pmtiles", "playgrounds.pmtiles", "clinics.pmtiles",
  "pharmacies.pmtiles", "transport.pmtiles", "parks.pmtiles", "sports.pmtiles", "shops.pmtiles",
  "quiet.pmtiles", "safety.pmtiles", "highschool.pmtiles", "air.pmtiles", "combined.pmtiles", "averages.json",
]);

export const MAX_RANGE_BYTES = 2 * 1024 * 1024;
export const MAX_JSON_BYTES = 2 * 1024 * 1024;

export function isAllowedDataFile(filename: string): boolean {
  return DATA_FILES.has(filename);
}

export function normalizeByteRange(value: string | null): string | null {
  if (!value) return null;
  const match = /^bytes=(\d+)-(\d+)$/.exec(value);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start || end - start + 1 > MAX_RANGE_BYTES) return null;
  return `bytes=${start}-${end}`;
}
