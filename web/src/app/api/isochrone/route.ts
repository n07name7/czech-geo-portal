import { type NextRequest, NextResponse } from "next/server";
import { BoundedTtlCache, fetchWithTimeout, isCzechCoordinate, UpstreamTimeoutError } from "../_lib/hardening";
import { BodyTooLargeError, clientIdentifier, ConcurrencyLimitError, liveApiLimiter, readLimitedJson, readLimitedResponseJson, runProtectedUpstream } from "../_lib/request-protection";

export const runtime = "nodejs";

// Reachability isochrones (where you can get in N minutes by foot / car) from
// the public FOSSGIS Valhalla server - real street-network polygons, no API
// key. Low volume (a couple of calls per report) and cached by rounded coords,
// so we stay a polite client. Swap to a self-hosted/ORS endpoint later without
// touching the consumer.

const VALHALLA = process.env.VALHALLA_URL || "https://valhalla1.openstreetmap.de/isochrone";

type Mode = "walk" | "drive";
const COSTING: Record<Mode, string> = { walk: "pedestrian", drive: "auto" };

type Geom = { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };

const TTL = 24 * 60 * 60 * 1000;
const cache = new BoundedTtlCache<{ geometry: Geom; areaKm2: number }>(256, TTL);

function isPosition(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1]) &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function isRing(value: unknown): value is number[][] {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isPosition)) return false;
  const first = value[0];
  const last = value[value.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function isGeometry(value: unknown): value is Geom {
  if (!value || typeof value !== "object") return false;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type === "Polygon") {
    return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0 && geometry.coordinates.every(isRing);
  }
  if (geometry.type === "MultiPolygon") {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length > 0 &&
      geometry.coordinates.every(
        (polygon) => Array.isArray(polygon) && polygon.length > 0 && polygon.every(isRing),
      )
    );
  }
  return false;
}

function ringAreaM2(ring: number[][]): number {
  if (ring.length < 4) return 0;
  const lat0 = ring[0][1];
  const mx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const my = 110540;
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[i + 1];
    s += ax * mx * (by * my) - bx * mx * (ay * my);
  }
  return Math.abs(s) / 2;
}

function areaKm2(geom: Geom): number {
  let m2 = 0;
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates as number[][][]) m2 += ringAreaM2(ring);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates as number[][][][])
      for (const ring of poly) m2 += ringAreaM2(ring);
  }
  return Math.round((m2 / 1e6) * 10) / 10;
}

export async function POST(req: NextRequest) {
  if (!liveApiLimiter.allow(clientIdentifier(req.headers)))
    return NextResponse.json({ error: "rate limit" }, { status: 429, headers: { "Retry-After": "60" } });
  let lat: number, lon: number, mode: Mode, minutes: number;
  try {
    const b = await readLimitedJson(req, 1_024) as { lat?: unknown; lon?: unknown; mode?: unknown; minutes?: unknown };
    if (!isCzechCoordinate(b.lat, b.lon))
      return NextResponse.json({ error: "bad coords" }, { status: 400 });
    lat = b.lat;
    lon = b.lon as number;
    mode = b.mode === "drive" ? "drive" : "walk";
    if (b.minutes === undefined) {
      minutes = 10;
    } else if (typeof b.minutes === "number" && Number.isInteger(b.minutes) && b.minutes >= 1 && b.minutes <= 60) {
      minutes = b.minutes;
    } else {
      return NextResponse.json({ error: "bad minutes" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return NextResponse.json({ error: "body too large" }, { status: 413 });
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${mode},${minutes}`;
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit);

  const body = {
    locations: [{ lat, lon }],
    costing: COSTING[mode],
    contours: [{ time: minutes }],
    polygons: true,
  };

  try {
    const res = await runProtectedUpstream("isochrone", key, () => fetchWithTimeout(VALHALLA, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Czech-Geo-Portal/1.0" },
      body: JSON.stringify(body),
    }));
    if (!res.ok) return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
    const json = (await readLimitedResponseJson(res)) as { features?: { geometry?: unknown }[] };
    const geom = json.features?.[0]?.geometry;
    if (!isGeometry(geom)) return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
    const data = { geometry: geom, areaKm2: areaKm2(geom) };
    cache.set(key, data);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ConcurrencyLimitError)
      return NextResponse.json({ error: "server busy" }, { status: 503, headers: { "Retry-After": "2" } });
    if (error instanceof UpstreamTimeoutError)
      return NextResponse.json({ error: "upstream timeout" }, { status: 504 });
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
}
