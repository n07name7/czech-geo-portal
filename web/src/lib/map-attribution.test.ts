import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BASEMAPS } from "./basemaps";
import type { StyleSpecification } from "maplibre-gl";

it("credits all providers reported by both Esri dark canvas services", () => {
  const style = BASEMAPS.find(b => b.id === "tmava")!.style as StyleSpecification;
  for (const source of Object.values(style.sources)) {
    expect(source).toHaveProperty("attribution", expect.stringContaining("HERE"));
    for (const name of ["Esri", "Garmin", "OpenStreetMap", "GIS user community"]) {
      expect((source as { attribution: string }).attribution).toContain(name);
    }
  }
});

it("keeps attribution controls enabled through the MapLibre default", () => {
  for (const component of ["ReportMap", "IsochroneMap", "PickMap"]) {
    const source = readFileSync(new URL(`../components/${component}.tsx`, import.meta.url), "utf8");
    expect(source).not.toMatch(/attributionControl:\s*(?:true|false)/);
  }
});
