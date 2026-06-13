// Address geocoding via Photon (komoot) — free, no key, CORS-enabled.
// Biased to Czechia; results outside CZ are dropped.

export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
  city?: string;
}

const PRAGUE: [number, number] = [14.437, 50.073];

function formatLabel(p: Record<string, unknown>): string {
  const street = p.street ?? p.name;
  const num = p.housenumber;
  const city = p.city ?? p.county;
  const parts = [
    [street, num].filter(Boolean).join(" "),
    city,
  ].filter(Boolean);
  return parts.join(", ") || String(p.name ?? "");
}

export async function geocode(
  query: string,
  bias: [number, number] = PRAGUE,
): Promise<GeocodeResult[]> {
  if (query.trim().length < 3) return [];
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}` +
    `&lat=${bias[1]}&lon=${bias[0]}&limit=6&lang=default`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const out: GeocodeResult[] = [];
  for (const f of data.features ?? []) {
    const p = f.properties ?? {};
    if (p.countrycode !== "CZ") continue;
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    out.push({ label: formatLabel(p), lat, lon, city: p.city });
  }
  return out;
}
