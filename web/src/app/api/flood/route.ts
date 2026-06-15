import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Flood-hazard category at the address from the official national CENIA layer
// "povodnové ohrožení 2019" (EU Floods Directive 2007/60/ES), WFS-queried for a
// small bbox around the point. category: 0 = outside mapped flood-risk area,
// 1..4 = low→very high. Report-time, cached, soft-fails.

const WFS = "https://gis.cenia.cz/geoserver/ows";
const TYPE = "povodnove_ohrozeni:ohrozeni_2019";

const cache = new Map<string, { at: number; data: { category: number } }>();
const TTL = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  let lat: number, lon: number;
  try {
    const b = await req.json();
    lat = Number(b.lat);
    lon = Number(b.lon);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return NextResponse.json({ error: "bad coords" }, { status: 400 });

  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

  // ~55 m box around the address (urn CRS → lat,lon axis order)
  const d = 0.0005;
  const bbox = `${lat - d},${lon - d},${lat + d},${lon + d},urn:ogc:def:crs:EPSG::4326`;
  const url =
    `${WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent(TYPE)}` +
    `&count=50&outputFormat=application/json&srsName=EPSG:4326&bbox=${encodeURIComponent(bbox)}`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": "Czech-Geo-Portal/1.0" } });
    if (!res.ok) return NextResponse.json({}, { status: 200 }); // soft-fail: omit
    const json = (await res.json()) as { features?: { properties?: { kat_ohr?: number } }[] };
    const feats = json.features ?? [];
    let category = 0; // success + no features = outside mapped flood-risk area
    for (const f of feats) {
      const k = Number(f.properties?.kat_ohr);
      if (Number.isFinite(k)) category = Math.max(category, k);
    }
    const data = { category };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}
