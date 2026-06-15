"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

import type { LayerId, BasemapId } from "@/types";
import { LAYERS, COMBINED_URL } from "@/lib/layers";
import { CITIES, type CityConfig } from "@/lib/cities";
import {
  PRAGUE_CENTER,
  PRAGUE_INITIAL_ZOOM,
  SCORE_GRADIENT,
  SCORE_GRADIENT_LIGHT,
  SCORE_GRADIENT_SATELLITE,
  FILL_OPACITY,
  FILL_OPACITY_LIGHT,
  FILL_OPACITY_SATELLITE,
  gradientWithInput,
} from "@/lib/map-config";

interface Props {
  activeLayer: LayerId;
  basemap: string | object;
  activeCity: CityConfig;
  basemapId: BasemapId;
  matchMode: boolean;
  weights: Record<LayerId, number>;
  /** What the popup measures — active layer name, or "match" label in match mode */
  measureLabel: string;
  /** Word under the score, e.g. "rating" */
  ratingLabel: string;
  /** Show/hide the coloured hexagon overlay */
  hexVisible: boolean;
}

/** Weighted-blend expression over combined-tile properties → 0..1.
 *  The raw weighted average clusters in a narrow low band (most layers score
 *  low for most cells), so colours barely move when weights change. We
 *  contrast-stretch that typical band [LO,HI] onto the full 0..1 colour range,
 *  which makes weight changes clearly visible while keeping order intact. */
function blendExpr(weights: Record<LayerId, number>): unknown {
  const active = LAYERS.filter((l) => (weights[l.id] ?? 0) > 0);
  const total = active.reduce((s, l) => s + weights[l.id], 0);
  if (total === 0) return 0;
  const sum: unknown[] = ["+"];
  for (const l of active) {
    sum.push(["*", weights[l.id], ["coalesce", ["get", l.id], 0]]);
  }
  const avg = ["/", sum, total];
  const LO = 0.1, HI = 0.58;
  return ["max", 0, ["min", 1, ["/", ["-", avg, LO], HI - LO]]];
}

function getGradientConfig(basemapId: BasemapId) {
  if (basemapId === "svetla")  return { gradient: SCORE_GRADIENT_LIGHT,    opacity: FILL_OPACITY_LIGHT };
  if (basemapId === "satelit") return { gradient: SCORE_GRADIENT_SATELLITE, opacity: FILL_OPACITY_SATELLITE };
  return                              { gradient: SCORE_GRADIENT,           opacity: FILL_OPACITY };
}

// ── Winding order helpers (RFC 7946) ─────────────────────────────────────────
function signedArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return a / 2;
}
const ensureCCW = (r: number[][]): number[][] => signedArea(r) > 0 ? [...r].reverse() : r;
const ensureCW  = (r: number[][]): number[][] => signedArea(r) < 0 ? [...r].reverse() : r;

const WORLD_RING: number[][] = ensureCCW([
  [-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90],
]);

/** Compute centroid of a closed polygon ring */
function ringCentroid(ring: number[][]): [number, number] {
  const n = ring.length - 1; // last point == first for closed rings
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
  return [x / n, y / n];
}

// ── H3 fill layers ────────────────────────────────────────────────────────────

function attachPmtilesLayers(
  map: maplibregl.Map,
  activeLayer: LayerId,
  gradient: unknown,
  fillOpacity: number,
) {
  for (const layer of LAYERS) {
    if (!layer.pmtilesUrl) continue;
    if (!map.getSource(layer.id)) {
      map.addSource(layer.id, {
        type: "vector",
        url: `pmtiles://${layer.pmtilesUrl}`,
      });
    }
    if (!map.getLayer(`${layer.id}-fill`)) {
      map.addLayer({
        id: `${layer.id}-fill`,
        type: "fill",
        source: layer.id,
        "source-layer": "cells",
        layout: { visibility: layer.id === activeLayer ? "visible" : "none" },
        paint: {
          "fill-color": gradient as maplibregl.ExpressionSpecification,
          // Multi-resolution tiles carry hexes at every zoom; slightly
          // lighter when zoomed out so the basemap stays readable.
          "fill-opacity": [
            "interpolate", ["linear"], ["zoom"],
            5, fillOpacity * 0.72,
            12, fillOpacity,
          ],
          "fill-antialias": false,
        },
      });

      // Highlight layer — filtered to hovered hex via setFilter; starts with no-match filter
      map.addLayer({
        id: `${layer.id}-highlight`,
        type: "line",
        source: layer.id,
        "source-layer": "cells",
        layout: { visibility: layer.id === activeLayer ? "visible" : "none" },
        filter: ["==", ["get", "cell"], ""],
        paint: {
          "line-color": "#ffffff",
          "line-width": 2,
        },
      });
    }
  }
}

// ── Combined match layer ────────────────────────────────────────────────────────

function attachCombinedLayer(
  map: maplibregl.Map,
  basemapId: BasemapId,
  weights: Record<LayerId, number>,
  visible: boolean,
) {
  if (!map.getSource("combined")) {
    map.addSource("combined", { type: "vector", url: `pmtiles://${COMBINED_URL}` });
  }
  const { opacity } = getGradientConfig(basemapId);
  if (!map.getLayer("combined-fill")) {
    map.addLayer({
      id: "combined-fill",
      type: "fill",
      source: "combined",
      "source-layer": "cells",
      layout: { visibility: visible ? "visible" : "none" },
      paint: {
        "fill-color": gradientWithInput(basemapId, blendExpr(weights)) as maplibregl.ExpressionSpecification,
        "fill-opacity": [
          "interpolate", ["linear"], ["zoom"],
          5, opacity * 0.72,
          12, opacity,
        ],
        "fill-antialias": false,
      },
    });
    map.addLayer({
      id: "combined-highlight",
      type: "line",
      source: "combined",
      "source-layer": "cells",
      layout: { visibility: visible ? "visible" : "none" },
      filter: ["==", ["get", "cell"], ""],
      paint: { "line-color": "#ffffff", "line-width": 2 },
    });
  }
}

// ── City boundary layers ──────────────────────────────────────────────────────

type BoundaryGeoJson = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

function buildMaskData(geojson: BoundaryGeoJson): GeoJSON.FeatureCollection {
  const geom = geojson.features[0].geometry;
  const rings: number[][][] =
    geom.type === "Polygon"
      ? [geom.coordinates[0] as number[][]]
      : (geom.coordinates as number[][][][]).map((p) => p[0]);
  return {
    type: "FeatureCollection",
    features: rings.map((ring) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [WORLD_RING, ensureCW(ring as number[][])] },
    })),
  };
}


function attachBoundaryLayers(map: maplibregl.Map, geojson: BoundaryGeoJson) {
  try {
    if (!map.getSource("city-mask")) {
      map.addSource("city-mask", { type: "geojson", data: buildMaskData(geojson) });
      map.addLayer({
        id: "city-mask-fill",
        type: "fill",
        source: "city-mask",
        paint: { "fill-color": "#000000", "fill-opacity": 0.45 },
      });
    }
  } catch (e) {
    console.error("[MapView] mask failed:", e);
  }
  if (!map.getSource("city-boundary")) {
    map.addSource("city-boundary", { type: "geojson", data: geojson });
    map.addLayer({
      id: "city-boundary-line",
      type: "line",
      source: "city-boundary",
      paint: { "line-color": "#e8a030", "line-width": 2.5, "line-opacity": 0.8 },
    });
  }
}

function refreshBoundary(map: maplibregl.Map, geojson: BoundaryGeoJson) {
  const maskSrc = map.getSource("city-mask") as maplibregl.GeoJSONSource | undefined;
  if (maskSrc) {
    maskSrc.setData(buildMaskData(geojson));
  } else {
    map.addSource("city-mask", { type: "geojson", data: buildMaskData(geojson) });
    map.addLayer({ id: "city-mask-fill", type: "fill", source: "city-mask",
      paint: { "fill-color": "#000000", "fill-opacity": 0.45 } });
  }

  const lineSrc = map.getSource("city-boundary") as maplibregl.GeoJSONSource | undefined;
  if (lineSrc) {
    lineSrc.setData(geojson);
  } else {
    map.addSource("city-boundary", { type: "geojson", data: geojson });
    map.addLayer({ id: "city-boundary-line", type: "line", source: "city-boundary",
      paint: { "line-color": "#e8a030", "line-width": 2.5, "line-opacity": 0.8 } });
  }
}

// ── Layer orchestration ───────────────────────────────────────────────────────

function attachAllLayers(
  map: maplibregl.Map,
  activeLayer: LayerId,
  boundary: BoundaryGeoJson | null,
  basemapId: BasemapId,
  matchMode: boolean,
  weights: Record<LayerId, number>,
) {
  const { gradient, opacity } = getGradientConfig(basemapId);
  attachPmtilesLayers(map, activeLayer, gradient, opacity);
  attachCombinedLayer(map, basemapId, weights, matchMode);
  if (boundary) attachBoundaryLayers(map, boundary);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MapView({ activeLayer, basemap, activeCity, basemapId, matchMode, weights, measureLabel, ratingLabel, hexVisible }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<maplibregl.Map | null>(null);
  const popupRef       = useRef<maplibregl.Popup | null>(null);
  const hoveredHexRef  = useRef<{ id: string | number; source: string } | null>(null);
  const activeLayerRef = useRef(activeLayer);
  const basemapRef     = useRef(basemap);
  const basemapIdRef   = useRef(basemapId);
  const activeCityRef  = useRef(activeCity);
  const matchModeRef   = useRef(matchMode);
  const weightsRef     = useRef(weights);
  const measureLabelRef = useRef(measureLabel);
  const ratingLabelRef  = useRef(ratingLabel);
  const hexVisibleRef  = useRef(hexVisible);
  const boundaryRef    = useRef<BoundaryGeoJson | null>(null);
  const boundaryCache  = useRef<Record<string, BoundaryGeoJson>>({});

  useEffect(() => { activeLayerRef.current = activeLayer; }, [activeLayer]);
  useEffect(() => { basemapIdRef.current   = basemapId;   }, [basemapId]);
  useEffect(() => { matchModeRef.current   = matchMode;   }, [matchMode]);
  useEffect(() => { weightsRef.current     = weights;     }, [weights]);
  useEffect(() => { measureLabelRef.current = measureLabel; }, [measureLabel]);
  useEffect(() => { ratingLabelRef.current  = ratingLabel;  }, [ratingLabel]);
  useEffect(() => { hexVisibleRef.current   = hexVisible;   }, [hexVisible]);

  // PMTiles protocol
  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    return () => maplibregl.removeProtocol("pmtiles");
  }, []);

  // Preload all city boundaries → instant switching
  useEffect(() => {
    CITIES.forEach((city) => {
      if (boundaryCache.current[city.id]) return;
      fetch(city.boundaryFile)
        .then((r) => r.ok ? r.json() : Promise.reject(r.status))
        .then((data: BoundaryGeoJson) => { boundaryCache.current[city.id] = data; })
        .catch(() => {});
    });
  }, []);

  // City boundary — use cache when available, otherwise fetch
  useEffect(() => {
    const apply = (data: BoundaryGeoJson) => {
      boundaryRef.current = data;
      const map = mapRef.current;
      if (!map) return;
      // setData on existing sources is safe even while tiles are still loading
      // (isStyleLoaded() is false then — e.g. satellite raster streaming in);
      // only addSource throws before the style finishes. Retry once on idle.
      try {
        refreshBoundary(map, data);
      } catch {
        map.once("idle", () => {
          if (boundaryRef.current !== data) return; // city changed again meanwhile
          refreshBoundary(map, data);
        });
      }
    };
    const cached = boundaryCache.current[activeCity.id];
    if (cached) { apply(cached); return; }

    let cancelled = false;
    fetch(activeCity.boundaryFile)
      .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((data: BoundaryGeoJson) => {
        if (cancelled) return;
        boundaryCache.current[activeCity.id] = data;
        apply(data);
      })
      .catch((e) => console.error("[MapView] boundary:", e));
    return () => { cancelled = true; };
  }, [activeCity.id, activeCity.boundaryFile]);

  // Fly to city
  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeCity.id === activeCityRef.current.id) return;
    activeCityRef.current = activeCity;
    map.flyTo({ center: activeCity.center, zoom: activeCity.zoom, duration: 1200 });
  }, [activeCity]);

  // Map init (once)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style: basemapRef.current as any,
      center: PRAGUE_CENTER,
      zoom: PRAGUE_INITIAL_ZOOM,
      maxZoom: 18,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "score-popup",
      anchor: "bottom",   // always appears above the tapped hex, never under browser chrome
      offset: 10,
    });
    popupRef.current = popup;

    map.on("load", () => {
      attachAllLayers(map, activeLayerRef.current, boundaryRef.current, basemapIdRef.current, matchModeRef.current, weightsRef.current);
    });

    // Explicit colours — CSS variables may not resolve inside MapLibre popup container.
    // Title = what is being measured (active layer name, or "match" in match mode);
    // rating word makes "73 %" read as a quality rating, not generic "accessibility".
    const escapeHtml = (s: string) =>
      s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    const popupHtml = (score: number) => {
      const pct = (score * 100).toFixed(0);
      const title = escapeHtml(measureLabelRef.current);
      const rating = escapeHtml(ratingLabelRef.current);
      return (
        `<div style="padding:12px 16px;min-width:120px;background:#0f1117;border-radius:2px;box-shadow:0 4px 20px rgba(0,0,0,.6)">` +
        `<div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#e8a030;margin-bottom:6px">${title}</div>` +
        `<div style="font-size:26px;font-weight:700;color:#4caf86;line-height:1">${pct}<span style="font-size:14px;margin-left:3px;color:#7a8a9a">/ 100</span></div>` +
        `<div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#7a8a9a;margin-top:6px">${rating}</div>` +
        `</div>`
      );
    };

    const clearHover = () => {
      if (hoveredHexRef.current) {
        const hlId = `${hoveredHexRef.current.source}-highlight`;
        if (map.getLayer(hlId)) map.setFilter(hlId, ["==", ["get", "cell"], ""]);
        hoveredHexRef.current = null;
      }
      popup.remove();
      map.getCanvas().style.cursor = "";
    };

    // Use querySourceFeatures + geographic distance instead of queryRenderedFeatures.
    // queryRenderedFeatures can silently return nothing when fill-opacity is low or
    // the rendering pipeline hasn't settled; querySourceFeatures is always reliable.
    // Hit radius follows the hex resolution rendered at the current zoom band.
    const hitRadiusDeg = (zoom: number): number => {
      if (zoom >= 12) return 0.003; // res 10, Ø ~150 m
      if (zoom >= 11) return 0.004; // res 9,  Ø ~350 m
      if (zoom >= 9)  return 0.009; // res 8,  Ø ~920 m
      if (zoom >= 8)  return 0.022; // res 7,  Ø ~2.4 km
      return 0.06;                  // res 6,  Ø ~6.4 km
    };
    // In match mode the weighted blend is computed here too (tiles carry
    // per-layer scores, not a precomputed 'score').
    const blendScore = (props: Record<string, unknown>): number => {
      const w = weightsRef.current;
      let sum = 0, total = 0;
      for (const l of LAYERS) {
        const wi = w[l.id] ?? 0;
        if (wi <= 0) continue;
        sum += wi * (Number(props[l.id]) || 0);
        total += wi;
      }
      return total > 0 ? sum / total : 0;
    };

    const activeFillId = () => (matchModeRef.current ? "combined-fill" : `${activeLayerRef.current}-fill`);

    // Highlight + popup for the hex under cursor. Shared by the fast hover path
    // and the reliable tap path.
    const applyHex = (sourceId: string, props: Record<string, unknown>, lngLat: maplibregl.LngLat): boolean => {
      const score = matchModeRef.current ? blendScore(props) : (Number(props.score) || 0);
      if (score <= 0) return false;
      const h3index = (props.cell as string) ?? "";
      if (!h3index) return false;
      if (String(hoveredHexRef.current?.id) !== String(h3index)) {
        if (hoveredHexRef.current) {
          const prevHl = `${hoveredHexRef.current.source}-highlight`;
          if (map.getLayer(prevHl)) map.setFilter(prevHl, ["==", ["get", "cell"], ""]);
        }
        hoveredHexRef.current = { id: String(h3index), source: sourceId };
        const hlId = `${sourceId}-highlight`;
        if (map.getLayer(hlId)) map.setFilter(hlId, ["==", ["get", "cell"], h3index]);
      }
      map.getCanvas().style.cursor = "pointer";
      popup.setLngLat(lngLat).setHTML(popupHtml(score)).addTo(map);
      return true;
    };

    // Fast hover: query only what is rendered under the cursor (O(1)-ish),
    // instead of scanning every source feature — avoids the lag/"tail" when
    // moving fast over a zoomed-out map with thousands of cells.
    const showHover = (point: maplibregl.Point, lngLat: maplibregl.LngLat): boolean => {
      if (!hexVisibleRef.current) return false;
      const lid = activeFillId();
      if (!map.getLayer(lid)) return false;
      const feats = map.queryRenderedFeatures(point, { layers: [lid] });
      const best = feats[0];
      if (!best) return false;
      const sourceId = matchModeRef.current ? "combined" : activeLayerRef.current;
      return applyHex(sourceId, best.properties ?? {}, lngLat);
    };

    const tryShowHex = (lngLat: maplibregl.LngLat): boolean => {
      if (!hexVisibleRef.current) return false;
      const sourceId = matchModeRef.current ? "combined" : activeLayerRef.current;
      if (!map.getSource(sourceId)) return false;

      const raw = map.querySourceFeatures(sourceId, { sourceLayer: "cells" });
      let best: ReturnType<typeof map.querySourceFeatures>[number] | null = null;
      let bestDist = Infinity;
      const cosLat = Math.cos(lngLat.lat * Math.PI / 180);
      for (const f of raw) {
        if (f.geometry?.type !== "Polygon") continue;
        const [lng, lat] = ringCentroid((f.geometry as GeoJSON.Polygon).coordinates[0]);
        const d = Math.hypot((lng - lngLat.lng) * cosLat, lat - lngLat.lat);
        if (d < bestDist) { bestDist = d; best = f; }
      }
      if (!best || bestDist > hitRadiusDeg(map.getZoom())) return false;

      const score = matchModeRef.current
        ? blendScore(best.properties ?? {})
        : (best.properties?.score ?? 0);
      if (score <= 0) return false; // no popup for cells with zero score

      const h3index = best.properties?.cell ?? String(best.id);
      if (!h3index) return false;

      if (String(hoveredHexRef.current?.id) !== String(h3index)) {
        if (hoveredHexRef.current) {
          const prevHl = `${hoveredHexRef.current.source}-highlight`;
          if (map.getLayer(prevHl)) map.setFilter(prevHl, ["==", ["get", "cell"], ""]);
        }
        hoveredHexRef.current = { id: String(h3index), source: sourceId };
        const hlId = `${sourceId}-highlight`;
        if (map.getLayer(hlId)) map.setFilter(hlId, ["==", ["get", "cell"], h3index]);
      }
      map.getCanvas().style.cursor = "pointer";
      popup.setLngLat(lngLat).setHTML(popupHtml(score)).addTo(map);
      return true;
    };

    // Track last touch time to suppress synthesized mouse events on Android
    let lastTouchTime = 0;

    // Mobile: use MapLibre's touchend (reliable on all Android versions)
    map.on("touchend", (e) => {
      if (e.originalEvent.changedTouches.length !== 1) return;
      lastTouchTime = Date.now();
      if (!tryShowHex(e.lngLat)) clearHover();
    });

    // Desktop hover — coalesce rapid mousemoves to one cheap lookup per frame
    let hoverRaf = 0;
    let pendingPoint: maplibregl.Point | null = null;
    let pendingLngLat: maplibregl.LngLat | null = null;
    map.on("mousemove", (e) => {
      if (Date.now() - lastTouchTime < 600) return;
      pendingPoint = e.point;
      pendingLngLat = e.lngLat;
      if (hoverRaf) return;
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0;
        if (pendingPoint && pendingLngLat && !showHover(pendingPoint, pendingLngLat)) clearHover();
      });
    });
    map.on("mouseleave", () => {
      if (Date.now() - lastTouchTime < 600) return;
      clearHover();
    });

    // Desktop click fallback
    map.on("click", (e) => {
      if (Date.now() - lastTouchTime < 600) return;
      if (!tryShowHex(e.lngLat)) clearHover();
    });

    // Close popup on user-initiated pan/zoom (not on programmatic flyTo)
    map.on("movestart", (e) => {
      if ((e as { originalEvent?: Event }).originalEvent) clearHover();
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Basemap switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map || basemap === basemapRef.current) return;
    basemapRef.current = basemap;
    map.once("style.load", () => {
      attachAllLayers(map, activeLayerRef.current, boundaryRef.current, basemapIdRef.current, matchModeRef.current, weightsRef.current);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.setStyle(basemap as any);
  }, [basemap]);

  // Layer visibility (single-layer vs match mode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    for (const layer of LAYERS) {
      const vis = hexVisible && !matchMode && layer.id === activeLayer ? "visible" : "none";
      if (map.getLayer(`${layer.id}-fill`)) {
        map.setLayoutProperty(`${layer.id}-fill`, "visibility", vis);
      }
      if (map.getLayer(`${layer.id}-highlight`)) {
        map.setLayoutProperty(`${layer.id}-highlight`, "visibility", vis);
      }
    }
    const matchVis = hexVisible && matchMode ? "visible" : "none";
    if (map.getLayer("combined-fill")) {
      map.setLayoutProperty("combined-fill", "visibility", matchVis);
    }
    if (map.getLayer("combined-highlight")) {
      map.setLayoutProperty("combined-highlight", "visibility", matchVis);
    }
    if (!hexVisible && popupRef.current) popupRef.current.remove();
  }, [activeLayer, matchMode, hexVisible]);

  // Recompute the weighted blend when sliders move — instant, no refetch
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer("combined-fill")) return;
    map.setPaintProperty(
      "combined-fill",
      "fill-color",
      gradientWithInput(basemapIdRef.current, blendExpr(weights)) as maplibregl.ExpressionSpecification,
    );
  }, [weights]);

  return <div ref={containerRef} className="w-full h-full" />;
}
