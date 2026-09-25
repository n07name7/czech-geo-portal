import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as nearbyPost } from "./nearby/route";
import { POST as flagsPost } from "./flags/route";
import { POST as floodPost } from "./flood/route";
import { POST as isochronePost } from "./isochrone/route";

const routes = [
  ["nearby", nearbyPost],
  ["flags", flagsPost],
  ["flood", floodPost],
  ["isochrone", isochronePost],
] as const;

function request(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("API route hardening", () => {
  it.each(routes)("%s rejects coordinates outside reasonable Czech coverage", async (_name, post) => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await post(request({ lat: 52.52, lon: 13.405, minutes: 10 }) as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "bad coords" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(routes)("%s rejects an oversized request body before upstream work", async (_name, post) => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await post(request({ padding: "x".repeat(2_000) }) as never);
    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([0, 1.5, 61, "10"])("isochrone rejects invalid minutes value %s", async (minutes) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [] }), { status: 200 }),
    );

    const response = await isochronePost(request({ lat: 50.0755, lon: 14.4378, minutes }) as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "bad minutes" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["nearby", nearbyPost],
    ["flags", flagsPost],
    ["flood", floodPost],
    ["isochrone", isochronePost],
  ] as const)("%s aborts a stalled upstream request and reports a gateway timeout", async (_name, post) => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (!init?.signal) return new Response("", { status: 500 });
      return await new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    });

    const pending = post(request({ lat: 50.09, lon: 14.45, minutes: 10 }) as never);
    await vi.advanceTimersByTimeAsync(60_000);
    const response = await pending;

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({ error: "upstream timeout" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(routes)("%s maps an upstream HTTP failure to bad gateway", async (_name, post) => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unavailable", { status: 503 }));

    const pending = post(request({ lat: 50.1, lon: 14.5, minutes: 10 }) as never);
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await pending;

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "upstream unavailable" });
  });

  it.each([
    ["nearby", nearbyPost, {}],
    ["flags", flagsPost, {}],
    ["flood", floodPost, {}],
    ["isochrone", isochronePost, { features: [] }],
  ] as const)("%s rejects a malformed successful upstream payload", async (_name, post, payload) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const response = await post(request({ lat: 50.11, lon: 14.51, minutes: 10 }) as never);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "upstream unavailable" });
  });

  it("flood does not turn an invalid hazard category into a factual result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [{ properties: { kat_ohr: 99 } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await floodPost(request({ lat: 50.12, lon: 14.52 }) as never);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "upstream unavailable" });
  });

  it("isochrone does not publish unsupported upstream geometry", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [{ geometry: { type: "Point", coordinates: [14.5, 50.1] } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await isochronePost(request({ lat: 50.13, lon: 14.53, minutes: 10 }) as never);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "upstream unavailable" });
  });

  it.each([
    ["nearby", nearbyPost, { elements: [] }, {}],
    ["flags", flagsPost, { elements: [] }, {}],
    ["flood", floodPost, { features: [] }, { category: 0 }],
  ] as const)("%s keeps a valid empty upstream result distinct from failure", async (_name, post, payload, expected) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const response = await post(request({ lat: 50.14, lon: 14.54 }) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expected);
  });

  it("isochrone returns a validated polygon without synthesizing a fallback", async () => {
    const geometry = {
      type: "Polygon",
      coordinates: [[[14.5, 50.1], [14.51, 50.1], [14.51, 50.11], [14.5, 50.1]]],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [{ geometry }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await isochronePost(request({ lat: 50.15, lon: 14.55, minutes: 10 }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.geometry).toEqual(geometry);
    expect(body.areaKm2).toBeGreaterThan(0);
  });
});
