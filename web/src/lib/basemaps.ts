import type { BasemapConfig } from "@/types";

const SATELLITE_STYLE = {
  version: 8 as const,
  sources: {
    satellite: {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri",
    },
  },
  layers: [{ id: "satellite-layer", type: "raster" as const, source: "satellite" }],
};

export const BASEMAPS: BasemapConfig[] = [
  {
    id: "svetla",
    labelKey: "basemap.svetla",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  },
  {
    id: "tmava",
    labelKey: "basemap.tmava",
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  },
  {
    id: "osm",
    labelKey: "basemap.osm",
    style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  },
  {
    id: "satelit",
    labelKey: "basemap.satelit",
    style: SATELLITE_STYLE,
  },
];

export const DEFAULT_BASEMAP = BASEMAPS[0];
