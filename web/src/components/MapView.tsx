"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

import type { LayerId } from "@/types";
import { LAYERS } from "@/lib/layers";
import {
  MAP_STYLE_URL,
  PRAGUE_CENTER,
  PRAGUE_INITIAL_ZOOM,
  SCORE_GRADIENT,
  FILL_OPACITY,
} from "@/lib/map-config";

interface Props {
  activeLayer: LayerId;
}

export default function MapView({ activeLayer }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    return () => maplibregl.removeProtocol("pmtiles");
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: PRAGUE_CENTER,
      zoom: PRAGUE_INITIAL_ZOOM,
    });
    mapRef.current = map;

    map.on("load", () => {
      for (const layer of LAYERS) {
        map.addSource(layer.id, {
          type: "vector",
          url: `pmtiles://${layer.pmtilesUrl}`,
        });
        map.addLayer({
          id: `${layer.id}-fill`,
          type: "fill",
          source: layer.id,
          "source-layer": "cells",
          layout: { visibility: "none" },
          paint: {
            "fill-color": SCORE_GRADIENT as maplibregl.ExpressionSpecification,
            "fill-opacity": FILL_OPACITY,
          },
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
