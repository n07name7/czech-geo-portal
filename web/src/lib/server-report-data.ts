import { open, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { VectorTile } from "@mapbox/vector-tile";
import { PMTiles, type RangeResponse, type Source } from "pmtiles";
import { PbfReader } from "pbf";

const MAX_READ_BYTES = 2 * 1024 * 1024;
const SCORE_IDS = [
  "schools", "kindergartens", "playgrounds", "clinics", "pharmacies", "transport", "parks",
  "sports", "shops", "quiet", "safety", "highschool", "air",
] as const;

type ResolveOptions = { localDirectory?: string; remoteBaseUrl?: string };

class NodeFileSource implements Source {
  constructor(private readonly path: string) {}
  getKey() { return `file:${this.path}`; }
  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length <= 0 || length > MAX_READ_BYTES) {
      throw new Error("invalid PMTiles read");
    }
    const info = await stat(this.path);
    if (offset >= info.size) throw new Error("PMTiles read outside archive");
    const actualLength = Math.min(length, info.size - offset);
    const handle = await open(this.path, "r");
    try {
      const buffer = Buffer.allocUnsafe(actualLength);
      const { bytesRead } = await handle.read(buffer, 0, actualLength, offset);
      const view = buffer.subarray(0, bytesRead);
      return {
        data: view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer,
        etag: `"${info.size}-${Math.trunc(info.mtimeMs)}"`,
      };
    } finally {
      await handle.close();
    }
  }
}

class HttpRangeSource implements Source {
  constructor(private readonly url: string) {}
  getKey() { return this.url; }
  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length <= 0 || length > MAX_READ_BYTES) {
      throw new Error("invalid PMTiles read");
    }
    const end = offset + length - 1;
    const response = await fetch(this.url, {
      headers: { Range: `bytes=${offset}-${end}` },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (response.status !== 206) throw new Error("remote PMTiles did not honor byte range");
    const contentRange = response.headers.get("content-range");
    const rangeMatch = contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+|\*)$/);
    if (!rangeMatch) throw new Error("invalid remote PMTiles content range");
    const [, rangeStart, rangeEnd] = rangeMatch.map(Number);
    if (rangeStart !== offset) throw new Error("remote PMTiles content range start mismatch");
    if (rangeEnd > end) throw new Error("remote PMTiles content range end exceeds request");
    const expectedLength = rangeEnd - rangeStart + 1;
    const declaredLength = Number(response.headers.get("content-length"));
    if (!Number.isSafeInteger(declaredLength) || declaredLength !== expectedLength || declaredLength > MAX_READ_BYTES) {
      throw new Error("invalid remote PMTiles content length");
    }
    const data = await response.arrayBuffer();
    if (data.byteLength !== declaredLength) throw new Error("truncated remote PMTiles response");
    return { data, etag: response.headers.get("etag") ?? undefined };
  }
}

function isCzechCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 48.5 && lat <= 51.1 && lon >= 12 && lon <= 18.9;
}

export function tileCoordinates(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  return {
    z,
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n),
  };
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function containsPoint(geometry: GeoJSON.Geometry, lon: number, lat: number): boolean {
  const polygonContains = (rings: number[][][]) => pointInRing(lon, lat, rings[0]) && !rings.slice(1).some((ring) => pointInRing(lon, lat, ring));
  if (geometry.type === "Polygon") return polygonContains(geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some(polygonContains);
  return false;
}

export function resolveRemoteArchiveUrl(base: string | undefined): string | null {
  if (!base) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    url.pathname = `${url.pathname.replace(/\/?$/, "/")}combined.pmtiles`;
    return url.toString();
  } catch {
    return null;
  }
}

const instanceCache = new Map<string, PMTiles>();

function getInstance(options: ResolveOptions): PMTiles {
  const directory = options.localDirectory ?? process.env.PMTILES_LOCAL_DIR;
  if (directory) {
    const path = resolve(process.cwd(), directory, "combined.pmtiles");
    const key = `file:${path}`;
    if (!instanceCache.has(key)) instanceCache.set(key, new PMTiles(new NodeFileSource(path)));
    return instanceCache.get(key)!;
  }
  
  const remoteUrl = resolveRemoteArchiveUrl(options.remoteBaseUrl ?? process.env.R2_DATA_BASE_URL);
  if (remoteUrl) {
    if (!instanceCache.has(remoteUrl)) instanceCache.set(remoteUrl, new PMTiles(new HttpRangeSource(remoteUrl)));
    return instanceCache.get(remoteUrl)!;
  }
  throw new Error("server PMTiles source is not configured");
}

export async function resolveServerScores(
  lat: number,
  lon: number,
  options: ResolveOptions = {},
): Promise<Record<string, number> | null> {
  if (!isCzechCoordinate(lat, lon)) throw new Error("coordinates outside Czechia");
  const { z, x, y } = tileCoordinates(lat, lon, 14);
  const tile = await getInstance(options).getZxy(z, x, y);
  if (!tile) return null;
  const vector = new VectorTile(new PbfReader(new Uint8Array(tile.data)));
  const layer = vector.layers.cells;
  if (!layer) throw new Error("combined PMTiles has no cells layer");

  let properties: Record<string, unknown> | null = null;
  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i);
    const geojson = feature.toGeoJSON(x, y, z);
    if (containsPoint(geojson.geometry, lon, lat)) {
      properties = feature.properties;
      break;
    }
  }
  if (!properties) return null;

  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(properties)) {
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    if (SCORE_IDS.includes(key as typeof SCORE_IDS[number]) && value >= 0 && value <= 1) result[key] = value;
    else if (key === "rent" && value >= 0 && value <= 10_000) result[key] = value;
    else if (key.startsWith("n_") && value >= 0 && value <= 1_000_000) result[key] = value;
  }
  if (!SCORE_IDS.every((id) => id in result)) throw new Error("combined PMTiles score record is incomplete");
  return result;
}
