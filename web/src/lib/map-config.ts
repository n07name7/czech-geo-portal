export const MAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export const PRAGUE_CENTER: [number, number] = [14.437, 50.073];
export const PRAGUE_INITIAL_ZOOM = 12;

// ── Fill gradients (для zoom ≥ 11, отдельные гексы) ──────────────────────────

export const SCORE_GRADIENT = [
  "interpolate", ["linear"], ["get", "score"],
  0,    "rgba(0,0,0,0)",
  0.05, "rgba(25, 45, 65, 0.4)",
  0.20, "#1a3a3a",
  0.40, "#1d7c48",
  0.60, "#52b146",
  0.80, "#d2e022",
  1.0,  "#fcd230",
];

export const SCORE_GRADIENT_LIGHT = [
  "interpolate", ["linear"], ["get", "score"],
  0,    "rgba(0,0,0,0)",
  0.10, "#fff5cc",
  0.30, "#ffd27f",
  0.50, "#ff9540",
  0.70, "#e65a28",
  0.90, "#b32400",
  1.0,  "#801a00",
];

// High-contrast on satellite imagery, but follows the universal "red = worse,
// green = better" intuition (the old ramp made the best score red).
export const SCORE_GRADIENT_SATELLITE = [
  "interpolate", ["linear"], ["get", "score"],
  0,    "rgba(0,0,0,0)",
  0.12, "rgba(255,51,0,0.55)",
  0.35, "#ff7a00",
  0.58, "#ffd400",
  0.80, "#9be000",
  1.0,  "#00e676",
];

// Rebuild a score gradient with a custom numeric input expression (used by
// the match mode, where the input is a weighted blend, not ["get","score"]).
export function gradientWithInput(
  basemapId: string,
  inputExpr: unknown,
): unknown[] {
  const base =
    basemapId === "svetla" ? SCORE_GRADIENT_LIGHT
    : basemapId === "satelit" ? SCORE_GRADIENT_SATELLITE
    : SCORE_GRADIENT;
  // base = ["interpolate", ["linear"], ["get","score"], ...stops]
  return ["interpolate", ["linear"], inputExpr, ...base.slice(3)];
}

// ── Legend CSS gradients ──────────────────────────────────────────────────────

export const LEGEND_GRADIENT_CSS: Record<string, string> = {
  tmava:   "linear-gradient(to right, #1a3a3a, #1d7c48, #52b146, #d2e022, #fcd230)",
  svetla:  "linear-gradient(to right, #fff5cc, #ffd27f, #ff9540, #e65a28, #801a00)",
  satelit: "linear-gradient(to right, #ff3300, #ff7a00, #ffd400, #9be000, #00e676)",
};

// ── Opacities ─────────────────────────────────────────────────────────────────

export const FILL_OPACITY           = 0.82;
export const FILL_OPACITY_LIGHT     = 0.76;
export const FILL_OPACITY_SATELLITE = 0.82;
