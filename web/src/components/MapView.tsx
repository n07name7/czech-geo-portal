"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

import type { LayerId } from "@/types";
import { LAYERS } from "@/lib/layers";
import {
  PRAGUE_CENTER,
  PRAGUE_INITIAL_ZOOM,
  SCORE_GRADIENT,
  FILL_OPACITY,
} from "@/lib/map-config";

interface Props {
  activeLayer: LayerId;
  basemap: string | object;
}

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
        },
      });
    }
  }
}

export default function MapView({ activeLayer, basemap }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const activeLayerRef = useRef(activeLayer);
  const basemapRef = useRef(basemap);

  useEffect(() => { activeLayerRef.current = activeLayer; }, [activeLayer]);

  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    return () => maplibregl.removeProtocol("pmtiles");
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: basemapRef.current as string,
      center: PRAGUE_CENTER,
      zoom: PRAGUE_INITIAL_ZOOM,
    });
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    mapRef.current = map;

    map.on("error", () => {});
    map.on("load", () => {
      attachPmtilesLayers(map, activeLayerRef.current);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || basemap === basemapRef.current) return;
    basemapRef.current = basemap;
    map.setStyle(basemap as string);
    map.once("style.load", () => {
      attachPmtilesLayers(map, activeLayerRef.current);
    });
  }, [basemap]);

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
