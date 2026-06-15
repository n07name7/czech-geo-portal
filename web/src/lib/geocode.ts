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

// Reverse: a clicked map point → a human label (keeps the exact clicked
// coordinates, only borrows the nearest address text for display).
export async function reverseGeocode(lat: number, lon: number): Promise<GeocodeResult> {
  const fallback = { label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=default`);
    if (!res.ok) return fallback;
    const data = await res.json();
    const f = data.features?.[0];
    if (!f) return fallback;
    const p = f.properties ?? {};
    return { label: formatLabel(p) || fallback.label, lat, lon, city: p.city };
  } catch {
    return fallback;
  }
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
  const seen = new Set<string>();
  for (const f of data.features ?? []) {
    const p = f.properties ?? {};
    if (p.countrycode !== "CZ") continue;
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const label = formatLabel(p);
    if (seen.has(label)) continue; // Photon often returns the same address several times
    seen.add(label);
    out.push({ label, lat, lon, city: p.city });
  }
  return out;
}
