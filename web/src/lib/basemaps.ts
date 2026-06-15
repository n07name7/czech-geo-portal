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

// Neutral dark-grey canvas (Esri "Dark Gray Canvas") — a reference basemap made
// to sit under coloured data overlays (hexagons, isochrones) without competing
// with them. Base + a separate reference layer for labels/roads. Keyless, same
// provider as the satellite layer. maxzoom caps the tiled LODs so MapLibre
// over-zooms (upscales) instead of going blank past z16.
const ESRI_CANVAS = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/";
const DARK_STYLE = {
  version: 8 as const,
  sources: {
    "dark-base": {
      type: "raster" as const,
      tiles: [ESRI_CANVAS + "World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 16,
      attribution: "Tiles © Esri",
    },
    "dark-ref": {
      type: "raster" as const,
      tiles: [ESRI_CANVAS + "World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 16,
    },
  },
  layers: [
    { id: "dark-base-layer", type: "raster" as const, source: "dark-base" },
    { id: "dark-ref-layer", type: "raster" as const, source: "dark-ref" },
  ],
};

export const BASEMAPS: BasemapConfig[] = [
  {
    id: "tmava",
    labelKey: "basemap.tmava",
    style: DARK_STYLE,
  },
  {
    id: "svetla",
    labelKey: "basemap.svetla",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  },
  {
    id: "satelit",
    labelKey: "basemap.satelit",
    style: SATELLITE_STYLE,
  },
];

export const DEFAULT_BASEMAP = BASEMAPS[0]; // tmava
