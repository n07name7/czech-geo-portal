export const MAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export const PRAGUE_CENTER: [number, number] = [14.437, 50.073];
export const PRAGUE_INITIAL_ZOOM = 12;

export const SCORE_GRADIENT = [
  "interpolate",
  ["linear"],
  ["get", "score"],
  0,   "rgba(0,0,0,0)",
  0.2, "#ffffb2",
  0.5, "#fd8d3c",
  0.8, "#e31a1c",
  1.0, "#800026",
] as const;

export const FILL_OPACITY = 0.65;
