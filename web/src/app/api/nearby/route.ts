import { type NextRequest, NextResponse } from "next/server";
import { BoundedTtlCache, fetchWithTimeout, isCzechCoordinate, UpstreamTimeoutError } from "../_lib/hardening";
import { BodyTooLargeError, clientIdentifier, ConcurrencyLimitError, liveApiLimiter, readLimitedJson, readLimitedResponseJson, runProtectedUpstream } from "../_lib/request-protection";

export const runtime = "nodejs";

// Named "what's around this address" lookup. Unlike the scored hex layers
// (which are anonymous counts), renters want concrete names + walking distance:
// "Lidl · 550 m · 7 min". We query OSM Overpass live for one point - a single
// small query per report, cached by rounded coordinates.

const OVERPASS = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

type Cat = "supermarket" | "pharmacy" | "health" | "school" | "transit" | "park";

type Poi = { name: string; dist: number; min: number; lat: number; lon: number };

type OverpassEl = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const TTL = 60 * 60 * 1000;
const cache = new BoundedTtlCache<Record<string, Poi>>(256, TTL);

function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180, la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function categorize(t: Record<string, string>): Cat | null {
  if (t.shop === "supermarket") return "supermarket";
  if (t.amenity === "pharmacy") return "pharmacy";
  if (t.amenity === "hospital" || t.amenity === "clinic" || t.amenity === "doctors") return "health";
  if (t.amenity === "school") return "school";
  if (
    t.highway === "bus_stop" ||
    t.railway === "tram_stop" ||
    t.railway === "station" ||
    t.railway === "subway_entrance" ||
    t.station === "subway"
  )
    return "transit";
  if (t.leisure === "park") return "park";
  return null;
}

async function queryOverpass(lat: number, lon: number): Promise<OverpassEl[]> {
  const q = `[out:json][timeout:25];
(
  node["shop"="supermarket"](around:1500,${lat},${lon});
  node["amenity"="pharmacy"](around:1500,${lat},${lon});
  nwr["amenity"~"^(hospital|clinic|doctors)$"](around:2000,${lat},${lon});
  nwr["amenity"="school"](around:1500,${lat},${lon});
  node["highway"="bus_stop"](around:700,${lat},${lon});
  node["railway"~"^(tram_stop|station|subway_entrance)$"](around:900,${lat},${lon});
  node["station"="subway"](around:1200,${lat},${lon});
  nwr["leisure"="park"](around:1200,${lat},${lon});
);
out center tags;`;

  // Overpass permits 25 seconds of query execution. Allow transport overhead,
  // but make only one attempt rather than multiplying the route's time budget.
  const res = await fetchWithTimeout(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "text/plain", "User-Agent": "Czech-Geo-Portal/1.0" },
    body: q,
  }, 30_000);
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = (await readLimitedResponseJson(res)) as { elements?: OverpassEl[]; remark?: string };
  if (!Array.isArray(json.elements) || json.remark) throw new Error("invalid overpass payload");
  return json.elements;
}

export async function POST(req: NextRequest) {
  if (!liveApiLimiter.allow(clientIdentifier(req.headers)))
    return NextResponse.json({ error: "rate limit" }, { status: 429, headers: { "Retry-After": "60" } });
  let lat: number, lon: number;
  try {
    const body = await readLimitedJson(req, 1_024) as { lat?: unknown; lon?: unknown };
    if (!isCzechCoordinate(body.lat, body.lon)) {
      return NextResponse.json({ error: "bad coords" }, { status: 400 });
    }
    lat = body.lat;
    lon = body.lon as number;
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return NextResponse.json({ error: "body too large" }, { status: 413 });
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit);

  let elements: OverpassEl[];
  try {
    elements = await runProtectedUpstream("nearby", key, () => queryOverpass(lat, lon));
  } catch (error) {
    if (error instanceof ConcurrencyLimitError)
      return NextResponse.json({ error: "server busy" }, { status: 503, headers: { "Retry-After": "2" } });
    if (error instanceof UpstreamTimeoutError)
      return NextResponse.json({ error: "upstream timeout" }, { status: 504 });
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }

  const nearest: Partial<Record<Cat, Poi>> = {};
  for (const el of elements) {
    const tags = el.tags;
    if (!tags) continue;
    const cat = categorize(tags);
    if (!cat) continue;
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (elLat == null || elLon == null) continue;
    // unnamed POIs are useless to a reader; parks/stops may legitimately lack a
    // name, so fall back to a generic label for those, skip the rest.
    let name = tags.name;
    if (!name) {
      if (cat === "park") name = "Park";
      else if (cat === "transit") continue;
      else continue;
    }
    const dist = haversine(lat, lon, elLat, elLon);
    const prev = nearest[cat];
    if (!prev || dist < prev.dist) {
      nearest[cat] = { name, dist, min: Math.max(1, Math.round(dist / 80)), lat: elLat, lon: elLon };
    }
  }

  cache.set(key, nearest as Record<string, Poi>);
  return NextResponse.json(nearest);
}
