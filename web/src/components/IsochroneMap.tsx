"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { BASEMAPS } from "@/lib/basemaps";

interface Props {
  lat: number;
  lon: number;
  mode: "walk" | "drive";
  color: string;
  /** PNG snapshot for the PDF */
  onImage?: (dataUrl: string) => void;
  /** Reachable area in km² (or null if unavailable) */
  onMeta?: (m: { areaKm2: number } | null) => void;
}

/** A small static map showing where you can get from the address in 10 minutes
 *  (street-network isochrone from /api/isochrone) over the dark basemap. */
export default function IsochroneMap({ lat, lon, mode, color, onImage, onMeta }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onImageRef = useRef(onImage);
  const onMetaRef = useRef(onMeta);
  useEffect(() => { onImageRef.current = onImage; }, [onImage]);
  useEffect(() => { onMetaRef.current = onMeta; }, [onMeta]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const dark = BASEMAPS.find((b) => b.id === "tmava")?.style as string;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: dark,
      center: [lon, lat],
      zoom: mode === "walk" ? 13 : 11,
      attributionControl: false,
      interactive: false,
      preserveDrawingBuffer: true,
    } as maplibregl.MapOptions);
    mapRef.current = map;
    let captured = false;

    map.on("load", async () => {
      new maplibregl.Marker({ color: "#e8a030" }).setLngLat([lon, lat]).addTo(map);
      try {
        const res = await fetch("/api/isochrone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon, mode, minutes: 10 }),
        });
        const d = await res.json();
        if (!d?.geometry) { onMetaRef.current?.(null); return; }

        map.addSource("iso", { type: "geojson", data: { type: "Feature", geometry: d.geometry, properties: {} } });
        map.addLayer({ id: "iso-fill", type: "fill", source: "iso", paint: { "fill-color": color, "fill-opacity": 0.3 } });
        map.addLayer({ id: "iso-line", type: "line", source: "iso", paint: { "line-color": color, "line-width": 2.2 } });

        // Symmetric bounds around the address so it stays at the canvas centre
        // (the PDF draws the marker there; drive isochrones are asymmetric).
        let mdLon = 0, mdLat = 0;
        const consider = (r: number[][]) => r.forEach((c) => {
          mdLon = Math.max(mdLon, Math.abs(c[0] - lon));
          mdLat = Math.max(mdLat, Math.abs(c[1] - lat));
        });
        const g = d.geometry as { type: string; coordinates: number[][][] | number[][][][] };
        if (g.type === "Polygon") (g.coordinates as number[][][]).forEach(consider);
        else (g.coordinates as number[][][][]).forEach((p) => p.forEach(consider));
        map.fitBounds(
          [[lon - mdLon, lat - mdLat], [lon + mdLon, lat + mdLat]],
          { padding: 18, duration: 0 },
        );

        onMetaRef.current?.({ areaKm2: d.areaKm2 });
        map.once("idle", () => {
          if (captured) return;
          captured = true;
          try { onImageRef.current?.(map.getCanvas().toDataURL("image/png")); } catch { /* not capturable */ }
        });
      } catch {
        onMetaRef.current?.(null);
      }
    });

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
