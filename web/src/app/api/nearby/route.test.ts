import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("allows a 10-second Overpass query without aborting at eight seconds", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise<Response>((resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason));
    setTimeout(() => resolve(new Response(JSON.stringify({ elements: [] }))), 10_000);
  })));
  const result = POST(new NextRequest("http://localhost/api/nearby", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lat:50.082,lon:14.429})}));
  await vi.advanceTimersByTimeAsync(10_001);
  expect((await result).status).toBe(200);
});
