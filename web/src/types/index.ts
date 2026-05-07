export type LayerId =
  | "schools"
  | "kindergartens"
  | "playgrounds"
  | "clinics"
  | "pharmacies"
  | "transport"
  | "parks"
  | "sports"
  | "shops";

export interface LayerConfig {
  id: LayerId;
  labelKey: string;
  icon: string;
  pmtilesUrl: string;
}

export interface CellInfo {
  cellId: string;
  score: number;
  layerScores: Partial<Record<LayerId, number>>;
}
