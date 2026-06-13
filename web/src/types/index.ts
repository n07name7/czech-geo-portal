export type LayerId =
  | "schools"
  | "kindergartens"
  | "playgrounds"
  | "clinics"
  | "pharmacies"
  | "transport"
  | "parks"
  | "sports"
  | "shops"
  | "quiet"
  | "safety";

export interface LayerConfig {
  id: LayerId;
  labelKey: string;
  icon?: string;
  pmtilesUrl: string;
}

export interface CellInfo {
  cellId: string;
  score: number;
  layerScores: Partial<Record<LayerId, number>>;
}

export type BasemapId = "svetla" | "tmava" | "osm" | "satelit";

export interface BasemapConfig {
  id: BasemapId;
  labelKey: string;
  style: string | object;
}
