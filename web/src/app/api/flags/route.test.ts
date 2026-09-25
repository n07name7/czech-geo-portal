import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const request = (lat = 50.083) => new NextRequest("http://localhost/api/flags", { method: "POST", body: JSON.stringify({ lat, lon: 14.431 }) });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("rejects an Overpass error remark instead of reporting empty risks", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ elements: [], remark: "runtime error" })));
  const response = await POST(request());
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "upstream unavailable" });
});

it("allows a ten-second query with one upstream attempt", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise<Response>((resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason));
    setTimeout(() => resolve(Response.json({ elements: [] })), 10_000);
  })));
  const pending = POST(request(50.084));
  await vi.advanceTimersByTimeAsync(10_001);
  expect((await pending).status).toBe(200);
  expect(fetch).toHaveBeenCalledOnce();
});
