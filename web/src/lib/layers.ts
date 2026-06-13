import type { LayerConfig } from "@/types";

const R2_BASE = process.env.NEXT_PUBLIC_R2_BASE_URL ?? "";
// Cache-bust query so a new deploy/data version forces a refetch instead of
// serving stale PMTiles from the browser or CDN cache.
const V = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
const bust = V ? `?v=${V}` : "";

export const LAYERS: LayerConfig[] = [
  { id: "schools",       labelKey: "layers.schools",       pmtilesUrl: `${R2_BASE}/schools.pmtiles${bust}` },
  { id: "kindergartens", labelKey: "layers.kindergartens", pmtilesUrl: `${R2_BASE}/kindergartens.pmtiles${bust}` },
  { id: "playgrounds",   labelKey: "layers.playgrounds",   pmtilesUrl: `${R2_BASE}/playgrounds.pmtiles${bust}` },
  { id: "clinics",       labelKey: "layers.clinics",       pmtilesUrl: `${R2_BASE}/clinics.pmtiles${bust}` },
  { id: "pharmacies",    labelKey: "layers.pharmacies",    pmtilesUrl: `${R2_BASE}/pharmacies.pmtiles${bust}` },
  { id: "transport",     labelKey: "layers.transport",     pmtilesUrl: `${R2_BASE}/transport.pmtiles${bust}` },
  { id: "parks",         labelKey: "layers.parks",         pmtilesUrl: `${R2_BASE}/parks.pmtiles${bust}` },
  { id: "sports",        labelKey: "layers.sports",        pmtilesUrl: `${R2_BASE}/sports.pmtiles${bust}` },
  { id: "shops",         labelKey: "layers.shops",         pmtilesUrl: `${R2_BASE}/shops.pmtiles${bust}` },
  { id: "quiet",         labelKey: "layers.quiet",         pmtilesUrl: `${R2_BASE}/quiet.pmtiles${bust}` },
  { id: "safety",        labelKey: "layers.safety",        pmtilesUrl: `${R2_BASE}/safety.pmtiles${bust}` },
];

// Combined dataset for match mode: one cell carries every layer's score as a
// property keyed by layer id. The "cells" source-layer matches per-layer tiles.
export const COMBINED_URL = `${R2_BASE}/combined.pmtiles${bust}`;
