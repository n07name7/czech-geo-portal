import { NextRequest, NextResponse } from "next/server";
import {
  isAllowedDataFile,
  MAX_JSON_BYTES,
  normalizeByteRange,
} from "../proxy-policy";
import { localDataResponse } from "../local-data";

const UPSTREAM_TIMEOUT_MS = 8_000;

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function contentLength(response: Response): number | null {
  const raw = response.headers.get("content-length");
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

function requestedLength(range: string): number {
  const match = /^bytes=(\d+)-(\d+)$/.exec(range);
  return match ? Number(match[2]) - Number(match[1]) + 1 : 0;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filename = path.join("/");
  if (!isAllowedDataFile(filename)) return error(404, "not found");

  const isArchive = filename.endsWith(".pmtiles");
  const range = normalizeByteRange(req.headers.get("range"));
  if (isArchive && !range) {
    return new NextResponse(null, {
      status: 416,
      headers: { "Accept-Ranges": "bytes" },
    });
  }

  const localDirectory = process.env.PMTILES_LOCAL_DIR;
  if (localDirectory) {
    const local = await localDataResponse(localDirectory, filename, req.headers.get("range"));
    return local ?? error(404, "not found");
  }

  const configuredBase = process.env.R2_DATA_BASE_URL;
  if (!configuredBase) return error(503, "data source unavailable");
  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`);
    if (upstreamUrl.protocol !== "https:" || upstreamUrl.username || upstreamUrl.password || upstreamUrl.search || upstreamUrl.hash) {
      return error(503, "invalid data source configuration");
    }
    upstreamUrl = new URL(filename, upstreamUrl);
  } catch {
    return error(503, "invalid data source configuration");
  }

  const upstreamHeaders = new Headers();
  if (range) upstreamHeaders.set("Range", range);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      return error(504, "upstream timeout");
    }
    return error(502, "upstream unavailable");
  }

  if (isArchive) {
    const length = contentLength(upstream);
    const contentRange = upstream.headers.get("content-range");
    if (
      upstream.status !== 206 ||
      !contentRange?.startsWith("bytes ") ||
      length === null ||
      length <= 0 ||
      length > requestedLength(range!)
    ) {
      return error(502, "invalid range response");
    }
  } else {
    const length = contentLength(upstream);
    if (!upstream.ok || length === null || length <= 0 || length > MAX_JSON_BYTES) {
      return error(502, "invalid data response");
    }
  }

  const headers = new Headers();
  for (const name of ["content-type", "content-length", "content-range", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
