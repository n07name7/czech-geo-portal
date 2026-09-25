import { describe, expect, it, vi } from "vitest";
import { COMBINED_URL, LAYERS } from "./layers";

describe("PMTiles URL configuration", () => {
  it("uses the allowlisted local proxy when no public data base is configured", () => {
    expect(COMBINED_URL).toMatch(/^\/api\/pmtiles\/combined\.pmtiles/);
    expect(LAYERS.every((layer) => layer.pmtilesUrl.startsWith("/api/pmtiles/"))).toBe(true);
  });

  it("keeps archive URLs free of query strings when a production build id exists", async () => {
    const previous = process.env.NEXT_PUBLIC_BUILD_ID;
    process.env.NEXT_PUBLIC_BUILD_ID = "production-build";
    vi.resetModules();
    const productionLayers = await import("./layers");
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BUILD_ID;
    else process.env.NEXT_PUBLIC_BUILD_ID = previous;

    expect(productionLayers.COMBINED_URL).not.toContain("?");
    expect(productionLayers.LAYERS.every((layer) => !layer.pmtilesUrl.includes("?"))).toBe(true);
  });
});
