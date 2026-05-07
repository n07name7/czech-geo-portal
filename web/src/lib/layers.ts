import type { LayerConfig } from "@/types";

const R2_BASE = process.env.NEXT_PUBLIC_R2_BASE_URL ?? "";

export const LAYERS: LayerConfig[] = [
  { id: "schools",       labelKey: "layers.schools",       icon: "🏫", pmtilesUrl: `${R2_BASE}/prague/schools.pmtiles` },
  { id: "kindergartens", labelKey: "layers.kindergartens", icon: "🧒", pmtilesUrl: `${R2_BASE}/prague/kindergartens.pmtiles` },
  { id: "playgrounds",   labelKey: "layers.playgrounds",   icon: "🛝", pmtilesUrl: `${R2_BASE}/prague/playgrounds.pmtiles` },
  { id: "clinics",       labelKey: "layers.clinics",       icon: "🏥", pmtilesUrl: `${R2_BASE}/prague/clinics.pmtiles` },
  { id: "pharmacies",    labelKey: "layers.pharmacies",    icon: "💊", pmtilesUrl: `${R2_BASE}/prague/pharmacies.pmtiles` },
  { id: "transport",     labelKey: "layers.transport",     icon: "🚌", pmtilesUrl: `${R2_BASE}/prague/transport.pmtiles` },
  { id: "parks",         labelKey: "layers.parks",         icon: "🌳", pmtilesUrl: `${R2_BASE}/prague/parks.pmtiles` },
  { id: "sports",        labelKey: "layers.sports",        icon: "⚽", pmtilesUrl: `${R2_BASE}/prague/sports.pmtiles` },
  { id: "shops",         labelKey: "layers.shops",         icon: "🛒", pmtilesUrl: `${R2_BASE}/prague/shops.pmtiles` },
];
