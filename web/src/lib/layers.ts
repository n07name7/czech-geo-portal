import type { LayerConfig } from "@/types";

const R2_BASE = process.env.NEXT_PUBLIC_R2_BASE_URL ?? "";

export const LAYERS: LayerConfig[] = [
  { id: "schools",       labelKey: "layers.schools",       pmtilesUrl: `${R2_BASE}/schools.pmtiles` },
  { id: "kindergartens", labelKey: "layers.kindergartens", pmtilesUrl: `${R2_BASE}/kindergartens.pmtiles` },
  { id: "playgrounds",   labelKey: "layers.playgrounds",   pmtilesUrl: `${R2_BASE}/playgrounds.pmtiles` },
  { id: "clinics",       labelKey: "layers.clinics",       pmtilesUrl: `${R2_BASE}/clinics.pmtiles` },
  { id: "pharmacies",    labelKey: "layers.pharmacies",    pmtilesUrl: `${R2_BASE}/pharmacies.pmtiles` },
  { id: "transport",     labelKey: "layers.transport",     pmtilesUrl: `${R2_BASE}/transport.pmtiles` },
  { id: "parks",         labelKey: "layers.parks",         pmtilesUrl: `${R2_BASE}/parks.pmtiles` },
  { id: "sports",        labelKey: "layers.sports",        pmtilesUrl: `${R2_BASE}/sports.pmtiles` },
  { id: "shops",         labelKey: "layers.shops",         pmtilesUrl: `${R2_BASE}/shops.pmtiles` },
];
