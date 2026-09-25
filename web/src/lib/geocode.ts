// Address geocoding via Photon (komoot) - free, no key, CORS-enabled.
// Biased to Czechia; results outside CZ are dropped.
import { CITIES } from "./cities";

export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
  city?: string;
}

const PRAGUE: [number, number] = [14.437, 50.073];

function normalizeCityName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Maps known EN/RU city names to the canonical Czech name used in CITIES */
const CITY_ALIASES: Record<string, string> = {
  // English
  prague: "praha", pilsen: "plzen",
  "ceske budejovice": "ceske budejovice", "budweis": "ceske budejovice",
  "hradec kralove": "hradec kralove",
  // Russian
  "прага": "praha", "брно": "brno", "острава": "ostrava",
  "пльзень": "plzen", "либерец": "liberec", "оломоуц": "olomouc",
  "ческе будеёвице": "ceske budejovice", "ческе-будеёвице": "ceske budejovice",
  "градец кралове": "hradec kralove", "градец-кралове": "hradec kralove",
};

export function supportedCoverageCity(city?: string): string | null {
  if (!city) return null;
  const normalized = normalizeCityName(city);

  // Direct match against Czech city names
  const match = CITIES.find(({ name }) => {
    const candidate = normalizeCityName(name);
    return normalized === candidate || normalized.startsWith(`${candidate} `);
  });
  if (match) return match.id;

  // Check EN/RU aliases
  const aliasId = CITY_ALIASES[normalized];
  if (aliasId) {
    const aliasMatch = CITIES.find(({ id }) => id === aliasId);
    if (aliasMatch) return aliasMatch.id;
  }

  return null;
}

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
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=default`, {
      signal: AbortSignal.timeout(5_000),
    });
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

export type GeocodeSearchResult =
  | { status: "available"; results: GeocodeResult[] }
  | { status: "unavailable" };

export async function searchAddresses(
  query: string,
  bias: [number, number] = PRAGUE,
): Promise<GeocodeSearchResult> {
  if (query.trim().length < 3) return { status: "available", results: [] };
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}` +
    `&lat=${bias[1]}&lon=${bias[0]}&limit=6&lang=default`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return { status: "unavailable" };
    const data = await res.json();
    const out: GeocodeResult[] = [];
    const seen = new Set<string>();
    for (const f of data.features ?? []) {
      const p = f.properties ?? {};
      if (p.countrycode !== "CZ") continue;
      const [lon, lat] = f.geometry?.coordinates ?? [];
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      const label = formatLabel(p);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push({ label, lat, lon, city: p.city });
    }
    return { status: "available", results: out };
  } catch {
    return { status: "unavailable" };
  }
}

export async function geocode(
  query: string,
  bias: [number, number] = PRAGUE,
): Promise<GeocodeResult[]> {
  const result = await searchAddresses(query, bias);
  return result.status === "available" ? result.results : [];
}
