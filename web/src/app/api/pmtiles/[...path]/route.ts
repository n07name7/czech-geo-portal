import { type NextRequest, NextResponse } from "next/server";

const RELEASE_BASE =
  "https://github.com/n07name7/czech-geo-portal/releases/download/data-latest";

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const filename = params.path.join("/");
  const upstream = `${RELEASE_BASE}/${filename}`;

  const upstreamHeaders = new Headers();
  const range = req.headers.get("range");
  if (range) upstreamHeaders.set("range", range);

  const res = await fetch(upstream, { headers: upstreamHeaders, redirect: "follow" });

  const responseHeaders = new Headers({
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=3600",
    "content-type": "application/octet-stream",
  });

  const contentRange = res.headers.get("content-range");
  if (contentRange) responseHeaders.set("content-range", contentRange);
  const contentLength = res.headers.get("content-length");
  if (contentLength) responseHeaders.set("content-length", contentLength);

  return new NextResponse(res.body, { status: res.status, headers: responseHeaders });
}
