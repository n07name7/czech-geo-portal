import { open, readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { isAllowedDataFile, MAX_JSON_BYTES, normalizeByteRange } from "./proxy-policy";

function archiveRange(range: string | null, size: number): { start: number; end: number } | null {
  const normalized = normalizeByteRange(range);
  if (!normalized) return null;
  const match = /^bytes=(\d+)-(\d+)$/.exec(normalized);
  if (!match) return null;
  const start = Number(match[1]);
  if (start >= size) return null;
  return { start, end: Math.min(Number(match[2]), size - 1) };
}

export async function localDataResponse(
  directory: string,
  filename: string,
  rangeHeader: string | null,
): Promise<Response | null> {
  if (!isAllowedDataFile(filename)) return null;
  const root = resolve(directory);
  const path = resolve(root, filename);
  if (path !== root && !path.startsWith(root + sep)) return null;

  let info;
  try {
    info = await stat(path);
  } catch {
    return null;
  }
  if (!info.isFile()) return null;

  if (filename.endsWith(".pmtiles")) {
    const range = archiveRange(rangeHeader, info.size);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes */${info.size}` },
      });
    }
    const length = range.end - range.start + 1;
    const buffer = Buffer.allocUnsafe(length);
    const handle = await open(path, "r");
    try {
      await handle.read(buffer, 0, length, range.start);
    } finally {
      await handle.close();
    }
    return new Response(buffer, {
      status: 206,
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=60",
        "Content-Length": String(length),
        "Content-Range": `bytes ${range.start}-${range.end}/${info.size}`,
        "Content-Type": "application/vnd.pmtiles",
        ETag: `W/\"${info.size}-${Math.trunc(info.mtimeMs)}\"`,
      },
    });
  }

  if (info.size <= 0 || info.size > MAX_JSON_BYTES) return new Response(null, { status: 502 });
  const buffer = await readFile(path);
  return new Response(buffer, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=60",
      "Content-Length": String(buffer.byteLength),
      "Content-Type": "application/json",
      ETag: `W/\"${info.size}-${Math.trunc(info.mtimeMs)}\"`,
    },
  });
}
