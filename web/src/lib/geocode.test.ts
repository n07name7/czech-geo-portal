import { afterEach, describe, expect, it, vi } from "vitest";
import { geocode, reverseGeocode, searchAddresses, supportedCoverageCity } from "./geocode";

afterEach(() => vi.restoreAllMocks());

describe("geocode resilience", () => {
  it("returns an empty suggestion list when Photon is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(geocode("Václavské náměstí")).resolves.toEqual([]);
    await expect(searchAddresses("Václavské náměstí")).resolves.toEqual({ status: "unavailable" });
  });

  it("drops malformed or non-Czech features", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ features: [
      { properties: { countrycode: "DE", name: "Berlin" }, geometry: { coordinates: [13.4, 52.5] } },
      { properties: { countrycode: "CZ", name: "Broken" }, geometry: { coordinates: ["x", null] } },
    ] }), { status: 200 }));
    await expect(geocode("test address")).resolves.toEqual([]);
  });

  it("maps Photon city names only to cities with published coverage", () => {
    expect(supportedCoverageCity("Praha")).toBe("praha");
    expect(supportedCoverageCity("České Budějovice")).toBe("ceske_budejovice");
    expect(supportedCoverageCity("Česká")).toBeNull();
    expect(supportedCoverageCity(undefined)).toBeNull();
  });

  it("bounds reverse geocoding with a timeout signal", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await reverseGeocode(50.08, 14.44);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/reverse?"), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
});
