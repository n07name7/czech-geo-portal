import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Reachability isochrones (where you can get in N minutes by foot / car) from
// the public FOSSGIS Valhalla server — real street-network polygons, no API
// key. Low volume (a couple of calls per report) and cached by rounded coords,
// so we stay a polite client. Swap to a self-hosted/ORS endpoint later without
// touching the consumer.

const VALHALLA = "https://valhalla1.openstreetmap.de/isochrone";

type Mode = "walk" | "drive";
const COSTING: Record<Mode, string> = { walk: "pedestrian", drive: "auto" };

type Geom = { type: string; coordinates: number[][][] | number[][][][] };

const cache = new Map<string, { at: number; data: { geometry: Geom; areaKm2: number } }>();
const TTL = 24 * 60 * 60 * 1000;

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
  let lat: number, lon: number, mode: Mode, minutes: number;
  try {
    const b = await req.json();
    lat = Number(b.lat);
    lon = Number(b.lon);
    mode = b.mode === "drive" ? "drive" : "walk";
    minutes = Number(b.minutes) > 0 ? Number(b.minutes) : 10;
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return NextResponse.json({ error: "bad coords" }, { status: 400 });

  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${mode},${minutes}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

  const body = {
    locations: [{ lat, lon }],
    costing: COSTING[mode],
    contours: [{ time: minutes }],
    polygons: true,
  };

  try {
    const res = await fetch(VALHALLA, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Czech-Geo-Portal/1.0" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return NextResponse.json({}, { status: 200 }); // soft-fail
    const json = (await res.json()) as { features?: { geometry: Geom }[] };
    const geom = json.features?.[0]?.geometry;
    if (!geom) return NextResponse.json({}, { status: 200 });
    const data = { geometry: geom, areaKm2: areaKm2(geom) };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}
