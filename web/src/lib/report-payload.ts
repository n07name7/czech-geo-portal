const SCORE_IDS = new Set([
  "schools", "kindergartens", "playgrounds", "clinics", "pharmacies", "transport", "parks",
  "sports", "shops", "quiet", "safety", "highschool", "air",
]);
const NEARBY_IDS = new Set(["supermarket", "pharmacy", "health", "school", "transit", "park"]);
const FLAG_IDS = new Set(["road", "railway", "gambling", "industrial", "nightclub"]);
const PDF_SOURCE_IDS = new Set(["nearby", "flood", "flags", "averages", "map", "isoWalk", "isoDrive"]);
const TOP_LEVEL_KEYS = new Set([
  "address", "scores", "session", "previewToken", "locale", "mapImage", "cityAvg", "cityName",
  "nearby", "rent", "rentCity", "rentQuarter", "isoWalk", "isoDrive", "flood", "flags", "unavailableSources",
]);
const MAX_IMAGE_CHARS = 1_500_000;

type ValidationError = "invalid_address" | "invalid_scores" | "payload_too_large" | "invalid_payload";
export type ReportPayloadValidation = { ok: true } | { ok: false; error: ValidationError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function optionalString(value: unknown, max: number): boolean {
  return value == null || (typeof value === "string" && value.length <= max);
}

function optionalNumber(value: unknown, min: number, max: number): boolean {
  return value == null || (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);
}

function validImage(value: unknown): "ok" | "large" | "invalid" {
  if (value == null) return "ok";
  if (typeof value !== "string") return "invalid";
  if (value.length > MAX_IMAGE_CHARS) return "large";
  return value.startsWith("data:image/png;base64,") ? "ok" : "invalid";
}

function validScores(value: unknown, allowCounts: boolean): boolean {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.length > 64) return false;
  return entries.every(([key, raw]) => {
    if (typeof raw !== "number" || !Number.isFinite(raw)) return false;
    if (SCORE_IDS.has(key)) return raw >= 0 && raw <= 1;
    if (key === "rent") return raw >= 0 && raw <= 10_000;
    if (allowCounts && key.startsWith("n_") && SCORE_IDS.has(key.slice(2))) return raw >= 0 && raw <= 1_000_000;
    return false;
  });
}

function validNearby(value: unknown): boolean {
  if (value == null) return true;
  if (!isRecord(value) || Object.keys(value).length > NEARBY_IDS.size || !hasOnlyKeys(value, NEARBY_IDS)) return false;
  return Object.values(value).every((item) => {
    if (!isRecord(item) || !hasOnlyKeys(item, new Set(["name", "dist", "min", "lat", "lon"]))) return false;
    return typeof item.name === "string" && item.name.length > 0 && item.name.length <= 300 &&
      optionalNumber(item.dist, 0, 100_000) && optionalNumber(item.min, 0, 2_000) &&
      optionalNumber(item.lat, -90, 90) && optionalNumber(item.lon, -180, 180);
  });
}

function validFlags(value: unknown): boolean {
  if (value == null) return true;
  if (!isRecord(value) || Object.keys(value).length > FLAG_IDS.size || !hasOnlyKeys(value, FLAG_IDS)) return false;
  return Object.values(value).every((item) =>
    isRecord(item) && hasOnlyKeys(item, new Set(["dist"])) && optionalNumber(item.dist, 0, 100_000) && item.dist != null
  );
}

function validIsochrone(value: unknown): "ok" | "large" | "invalid" {
  if (value == null) return "ok";
  if (!isRecord(value) || !hasOnlyKeys(value, new Set(["img", "area"]))) return "invalid";
  const image = validImage(value.img);
  if (image !== "ok") return image;
  return typeof value.img === "string" && optionalNumber(value.area, 0, 100_000) ? "ok" : "invalid";
}

export function validateReportPayload(body: Record<string, unknown>): ReportPayloadValidation {
  if (!hasOnlyKeys(body, TOP_LEVEL_KEYS)) return { ok: false, error: "invalid_payload" };
  if (typeof body.address !== "string" || body.address.trim().length < 3 || body.address.length > 300) {
    return { ok: false, error: "invalid_address" };
  }
  if (!validScores(body.scores, true)) return { ok: false, error: "invalid_scores" };

  for (const value of [body.mapImage]) {
    const result = validImage(value);
    if (result === "large") return { ok: false, error: "payload_too_large" };
    if (result === "invalid") return { ok: false, error: "invalid_payload" };
  }
  for (const value of [body.isoWalk, body.isoDrive]) {
    const result = validIsochrone(value);
    if (result === "large") return { ok: false, error: "payload_too_large" };
    if (result === "invalid") return { ok: false, error: "invalid_payload" };
  }

  if (body.cityAvg != null && !validScores(body.cityAvg, false)) return { ok: false, error: "invalid_payload" };
  if (!optionalString(body.cityName, 100) || !optionalString(body.rentQuarter, 50)) return { ok: false, error: "invalid_payload" };
  if (!optionalString(body.session, 512) || !optionalString(body.previewToken, 512)) return { ok: false, error: "invalid_payload" };
  if (body.locale != null && !["cs", "en", "ru"].includes(String(body.locale))) return { ok: false, error: "invalid_payload" };
  if (!optionalNumber(body.rent, 0, 10_000) || !optionalNumber(body.rentCity, 0, 10_000)) return { ok: false, error: "invalid_payload" };
  if (body.flood != null && (!Number.isInteger(body.flood) || (body.flood as number) < 0 || (body.flood as number) > 4)) return { ok: false, error: "invalid_payload" };
  if (!validNearby(body.nearby) || !validFlags(body.flags)) return { ok: false, error: "invalid_payload" };
  if (body.unavailableSources != null && (
    !Array.isArray(body.unavailableSources) ||
    body.unavailableSources.length > PDF_SOURCE_IDS.size ||
    new Set(body.unavailableSources).size !== body.unavailableSources.length ||
    !body.unavailableSources.every((source) => typeof source === "string" && PDF_SOURCE_IDS.has(source))
  )) return { ok: false, error: "invalid_payload" };
  return { ok: true };
}
