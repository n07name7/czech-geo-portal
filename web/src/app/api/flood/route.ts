import { type NextRequest, NextResponse } from "next/server";
import { BoundedTtlCache, fetchWithTimeout, isCzechCoordinate, UpstreamTimeoutError } from "../_lib/hardening";
import { BodyTooLargeError, clientIdentifier, ConcurrencyLimitError, liveApiLimiter, readLimitedJson, readLimitedResponseJson, runProtectedUpstream } from "../_lib/request-protection";

export const runtime = "nodejs";

// Flood-hazard category at the address from the official national CENIA layer
// "povodnové ohrožení 2019" (EU Floods Directive 2007/60/ES), WFS-queried for a
// small bbox around the point. category: 0 = outside mapped flood-risk area,
// 1..4 = low→very high. Report-time, cached, soft-fails.

const WFS = "https://gis.cenia.cz/geoserver/ows";
const TYPE = "povodnove_ohrozeni:ohrozeni_2019";

const TTL = 24 * 60 * 60 * 1000;
const cache = new BoundedTtlCache<{ category: number }>(256, TTL);

export async function POST(req: NextRequest) {
  if (!liveApiLimiter.allow(clientIdentifier(req.headers)))
    return NextResponse.json({ error: "rate limit" }, { status: 429, headers: { "Retry-After": "60" } });
  let lat: number, lon: number;
  try {
    const b = await readLimitedJson(req, 1_024) as { lat?: unknown; lon?: unknown };
    if (!isCzechCoordinate(b.lat, b.lon))
      return NextResponse.json({ error: "bad coords" }, { status: 400 });
    lat = b.lat;
    lon = b.lon as number;
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return NextResponse.json({ error: "body too large" }, { status: 413 });
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit);

  // ~55 m box around the address (urn CRS → lat,lon axis order)
  const d = 0.0005;
  const bbox = `${lat - d},${lon - d},${lat + d},${lon + d},urn:ogc:def:crs:EPSG::4326`;
  const url =
    `${WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent(TYPE)}` +
    `&count=50&outputFormat=application/json&srsName=EPSG:4326&bbox=${encodeURIComponent(bbox)}`;

  try {
    const res = await runProtectedUpstream("flood", key, () => fetchWithTimeout(url, { headers: { "User-Agent": "Czech-Geo-Portal/1.0" } }));
    if (!res.ok) return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
    const json = (await readLimitedResponseJson(res)) as { features?: { properties?: { kat_ohr?: number } }[] };
    if (!Array.isArray(json.features))
      return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
    const feats = json.features;
    let category = 0; // success + no features = outside mapped flood-risk area
    for (const f of feats) {
      const k = f.properties?.kat_ohr;
      if (typeof k !== "number" || !Number.isInteger(k) || k < 1 || k > 4)
        return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
      category = Math.max(category, k);
    }
    const data = { category };
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
