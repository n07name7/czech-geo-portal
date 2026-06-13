"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

import type { LayerId, BasemapId } from "@/types";
import { LAYERS } from "@/lib/layers";
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
} from "@/lib/map-config";

interface Props {
  activeLayer: LayerId;
  basemap: string | object;
  activeCity: CityConfig;
  basemapId: BasemapId;
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
) {
  const { gradient, opacity } = getGradientConfig(basemapId);
  attachPmtilesLayers(map, activeLayer, gradient, opacity);
  if (boundary) attachBoundaryLayers(map, boundary);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MapView({ activeLayer, basemap, activeCity, basemapId }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<maplibregl.Map | null>(null);
  const popupRef       = useRef<maplibregl.Popup | null>(null);
  const hoveredHexRef  = useRef<{ id: string | number; source: string } | null>(null);
  const activeLayerRef = useRef(activeLayer);
  const basemapRef     = useRef(basemap);
  const basemapIdRef   = useRef(basemapId);
  const activeCityRef  = useRef(activeCity);
  const boundaryRef    = useRef<BoundaryGeoJson | null>(null);
  const boundaryCache  = useRef<Record<string, BoundaryGeoJson>>({});

  useEffect(() => { activeLayerRef.current = activeLayer; }, [activeLayer]);
  useEffect(() => { basemapIdRef.current   = basemapId;   }, [basemapId]);

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
      attachAllLayers(map, activeLayerRef.current, boundaryRef.current, basemapIdRef.current);
    });

    // Explicit colours — CSS variables may not resolve inside MapLibre popup container
    const popupHtml = (score: number) =>
      `<div style="padding:12px 16px;min-width:110px;background:#0f1117;border-radius:2px;box-shadow:0 4px 20px rgba(0,0,0,.6)">` +
      `<div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#7a8a9a;margin-bottom:6px">Dostupnost</div>` +
      `<div style="font-size:26px;font-weight:700;color:#4caf86;line-height:1">${(score * 100).toFixed(0)}<span style="font-size:14px;margin-left:3px;color:#7a8a9a">%</span></div>` +
      `</div>`;

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
    const tryShowHex = (lngLat: maplibregl.LngLat): boolean => {
      const sourceId = activeLayerRef.current;
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

      const score = best.properties?.score ?? 0;
      if (score <= 0) return false; // no popup for cells with zero accessibility

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

    // Desktop hover
    map.on("mousemove", (e) => {
      if (Date.now() - lastTouchTime < 600) return;
      if (!tryShowHex(e.lngLat)) clearHover();
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
      attachAllLayers(map, activeLayerRef.current, boundaryRef.current, basemapIdRef.current);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.setStyle(basemap as any);
  }, [basemap]);

  // Layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    for (const layer of LAYERS) {
      const vis = layer.id === activeLayer ? "visible" : "none";
      if (map.getLayer(`${layer.id}-fill`)) {
        map.setLayoutProperty(`${layer.id}-fill`, "visibility", vis);
      }
      if (map.getLayer(`${layer.id}-highlight`)) {
        map.setLayoutProperty(`${layer.id}-highlight`, "visibility", vis);
      }
    }
  }, [activeLayer]);

  return <div ref={containerRef} className="w-full h-full" />;
}
