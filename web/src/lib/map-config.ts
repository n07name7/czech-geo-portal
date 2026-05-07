export const MAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export const PRAGUE_CENTER: [number, number] = [14.437, 50.073];
export const PRAGUE_INITIAL_ZOOM = 12;

// Colors match landing page hex visualization (dark green → amber)
export const SCORE_GRADIENT = [
  "interpolate",
  ["linear"],
  ["get", "score"],
  0,    "rgba(0,0,0,0)",
  0.08, "#111820",
  0.22, "#162d22",
  0.40, "#1d5c38",
  0.58, "#388c42",
  0.72, "#79b025",
  0.85, "#c49020",
  1.0,  "#e8a030",
] as const;

export const FILL_OPACITY = 0.82;
