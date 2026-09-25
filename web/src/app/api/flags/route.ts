import { type NextRequest, NextResponse } from "next/server";
import { BoundedTtlCache, fetchWithTimeout, isCzechCoordinate, UpstreamTimeoutError } from "../_lib/hardening";
import { BodyTooLargeError, clientIdentifier, ConcurrencyLimitError, liveApiLimiter, readLimitedJson, readLimitedResponseJson, runProtectedUpstream } from "../_lib/request-protection";

export const runtime = "nodejs";

// "Red flags" near an address - the downsides a listing won't mention: a busy
// road, railway, gambling hall, industrial zone, nightclub. Live OSM Overpass
// query around the point; nearest distance per category. Cached, soft-fails.

const OVERPASS = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

type Cat = "road" | "railway" | "gambling" | "industrial" | "nightclub";

type Coord = { lat: number; lon: number };
type El = {
  type: string;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: Coord[];
  members?: { geometry?: Coord[] }[];
};

const TTL = 60 * 60 * 1000;
const cache = new BoundedTtlCache<Record<string, { dist: number }>>(256, TTL);

function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180, la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function coordsOf(el: El): Coord[] {
  if (el.lat != null && el.lon != null) return [{ lat: el.lat, lon: el.lon }];
  if (el.geometry) return el.geometry;
  if (el.members) return el.members.flatMap((m) => m.geometry ?? []);
  return [];
}

function categorize(t: Record<string, string>): Cat | null {
  if (/^(motorway|trunk|primary|secondary)$/.test(t.highway || "")) return "road";
  if (t.railway === "rail") return "railway";
  if (t.amenity === "gambling" || t.amenity === "casino" || t.leisure === "adult_gaming_centre" || t.shop === "bookmaker")
    return "gambling";
  if (t.amenity === "nightclub") return "nightclub";
  if (t.landuse === "industrial") return "industrial";
  return null;
}

export async function POST(req: NextRequest) {
  if (!liveApiLimiter.allow(clientIdentifier(req.headers)))
    return NextResponse.json({ error: "rate limit" }, { status: 429, headers: { "Retry-After": "60" } });
  let lat: number, lon: number;
  try {
    const b = await readLimitedJson(req, 1_024) as { lat?: unknown; lon?: unknown };
    if (!isCzechCoordinate(b.lat, b.lon))
      return NextResponse.json({ error: "bad coords" }, { status: 400 });
    lat = b.lat; lon = b.lon as number;
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return NextResponse.json({ error: "body too large" }, { status: 413 });
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit);

  const q = `[out:json][timeout:25];
(
  way["highway"~"^(motorway|trunk|primary)$"](around:200,${lat},${lon});
  way["highway"="secondary"](around:80,${lat},${lon});
  way["railway"="rail"](around:200,${lat},${lon});
  nwr["amenity"="gambling"](around:350,${lat},${lon});
  nwr["amenity"="casino"](around:350,${lat},${lon});
  nwr["leisure"="adult_gaming_centre"](around:350,${lat},${lon});
  nwr["shop"="bookmaker"](around:350,${lat},${lon});
  nwr["amenity"="nightclub"](around:300,${lat},${lon});
  way["landuse"="industrial"](around:300,${lat},${lon});
  relation["landuse"="industrial"](around:300,${lat},${lon});
);
out geom;`;

  let elements: El[];
  try {
    // Overpass permits 25 seconds of query execution - the same budget as
    // /api/nearby (same upstream, same out-geom pattern): real queries run
    // 7-10 s, so a shorter timeout would reject healthy responses.
    const res = await runProtectedUpstream("flags", key, () => fetchWithTimeout(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "text/plain", "User-Agent": "Czech-Geo-Portal/1.0" },
      body: q,
    }, 30_000));
    if (!res.ok) return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
    const json = (await readLimitedResponseJson(res)) as { elements?: El[]; remark?: string };
    if (!Array.isArray(json.elements) || json.remark)
      return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
    elements = json.elements;
  } catch (error) {
    if (error instanceof ConcurrencyLimitError)
      return NextResponse.json({ error: "server busy" }, { status: 503, headers: { "Retry-After": "2" } });
    if (error instanceof UpstreamTimeoutError)
      return NextResponse.json({ error: "upstream timeout" }, { status: 504 });
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }

  const nearest: Partial<Record<Cat, { dist: number }>> = {};
  for (const el of elements) {
    const cat = el.tags ? categorize(el.tags) : null;
    if (!cat) continue;
    let min = Infinity;
    for (const c of coordsOf(el)) {
      const d = haversine(lat, lon, c.lat, c.lon);
      if (d < min) min = d;
    }
    if (!Number.isFinite(min)) continue;
    const dist = Math.round(min);
    if (!nearest[cat] || dist < nearest[cat]!.dist) nearest[cat] = { dist };
  }

  const data = nearest as Record<string, { dist: number }>;
  cache.set(key, data);
  return NextResponse.json(data);
}
