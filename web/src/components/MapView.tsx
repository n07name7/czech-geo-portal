"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

import type { LayerId } from "@/types";
import { LAYERS } from "@/lib/layers";
import type { CityConfig } from "@/lib/cities";
import {
  PRAGUE_CENTER,
  PRAGUE_INITIAL_ZOOM,
  SCORE_GRADIENT,
  FILL_OPACITY,
} from "@/lib/map-config";

interface Props {
  activeLayer: LayerId;
  basemap: string | object;
  activeCity: CityConfig;
}

// ── H3 hexagon layers ────────────────────────────────────────────────────────

function attachPmtilesLayers(map: maplibregl.Map, activeLayer: LayerId) {
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
          "fill-color": SCORE_GRADIENT as unknown as maplibregl.ExpressionSpecification,
          "fill-opacity": FILL_OPACITY,
          "fill-antialias": false,
        },
      });
    }
  }
}

// ── City boundary layers ─────────────────────────────────────────────────────

type BoundaryGeoJson = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

function buildMaskData(geojson: BoundaryGeoJson): GeoJSON.FeatureCollection {
  const worldRing: number[][] = [
    [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90],
  ];
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
      geometry: { type: "Polygon", coordinates: [worldRing, ring] },
    })),
  };
}

function attachBoundaryLayers(map: maplibregl.Map, geojson: BoundaryGeoJson) {
  const maskData = buildMaskData(geojson);

  if (!map.getSource("city-mask")) {
    map.addSource("city-mask", { type: "geojson", data: maskData });
  } else {
    (map.getSource("city-mask") as maplibregl.GeoJSONSource).setData(maskData);
  }
  if (!map.getLayer("city-mask-fill")) {
    map.addLayer({
      id: "city-mask-fill",
      type: "fill",
      source: "city-mask",
      paint: { "fill-color": "#0b0d12", "fill-opacity": 0.55 },
    });
  }

  if (!map.getSource("city-boundary")) {
    map.addSource("city-boundary", { type: "geojson", data: geojson });
  } else {
    (map.getSource("city-boundary") as maplibregl.GeoJSONSource).setData(geojson);
  }
  if (!map.getLayer("city-boundary-line")) {
    map.addLayer({
      id: "city-boundary-line",
      type: "line",
      source: "city-boundary",
      paint: { "line-color": "#e8a030", "line-width": 1.5, "line-opacity": 0.55 },
    });
  }
}

function updateBoundary(map: maplibregl.Map, geojson: BoundaryGeoJson) {
  const maskSrc = map.getSource("city-mask") as maplibregl.GeoJSONSource | undefined;
  const lineSrc = map.getSource("city-boundary") as maplibregl.GeoJSONSource | undefined;
  if (maskSrc && lineSrc) {
    maskSrc.setData(buildMaskData(geojson));
    lineSrc.setData(geojson);
  } else {
    attachBoundaryLayers(map, geojson);
  }
}

function attachAllLayers(map: maplibregl.Map, activeLayer: LayerId, boundary: BoundaryGeoJson | null) {
  attachPmtilesLayers(map, activeLayer);
  if (boundary) attachBoundaryLayers(map, boundary);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MapView({ activeLayer, basemap, activeCity }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const activeLayerRef = useRef(activeLayer);
  const basemapRef = useRef(basemap);
  const activeCityRef = useRef(activeCity);
  const boundaryRef = useRef<BoundaryGeoJson | null>(null);

  useEffect(() => { activeLayerRef.current = activeLayer; }, [activeLayer]);

  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    return () => maplibregl.removeProtocol("pmtiles");
  }, []);

  // Fetch boundary when city changes
  useEffect(() => {
    fetch(activeCity.boundaryFile)
      .then((r) => r.json())
      .then((data: BoundaryGeoJson) => {
        boundaryRef.current = data;
        const map = mapRef.current;
        if (map && map.isStyleLoaded()) {
          updateBoundary(map, data);
        }
      })
      .catch(() => {});
  }, [activeCity.boundaryFile]);

  // Fly to city when it changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeCity.id === activeCityRef.current.id) return;
    activeCityRef.current = activeCity;
    map.flyTo({ center: activeCity.center, zoom: activeCity.zoom, duration: 1200 });
  }, [activeCity]);

  // Map initialisation
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style: basemapRef.current as any,
      center: PRAGUE_CENTER,
      zoom: PRAGUE_INITIAL_ZOOM,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("error", () => {});
    map.on("load", () => {
      attachAllLayers(map, activeLayerRef.current, boundaryRef.current);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Basemap switching
  useEffect(() => {
    const map = mapRef.current;
    if (!map || basemap === basemapRef.current) return;
    basemapRef.current = basemap;
    map.once("style.load", () => {
      attachAllLayers(map, activeLayerRef.current, boundaryRef.current);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.setStyle(basemap as any);
  }, [basemap]);

  // Active layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    for (const layer of LAYERS) {
      const vis = layer.id === activeLayer ? "visible" : "none";
      if (map.getLayer(`${layer.id}-fill`)) {
        map.setLayoutProperty(`${layer.id}-fill`, "visibility", vis);
      }
    }
  }, [activeLayer]);

  return <div ref={containerRef} className="w-full h-full" />;
}
