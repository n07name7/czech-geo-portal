"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

import { LAYERS, COMBINED_URL } from "@/lib/layers";
import { BASEMAPS } from "@/lib/basemaps";
import { FILL_OPACITY, gradientWithInput } from "@/lib/map-config";

const EQUAL_BLEND = (() => {
  const sum: unknown[] = ["+"];
  for (const l of LAYERS) sum.push(["coalesce", ["get", l.id], 0]);
  return ["/", sum, LAYERS.length];
})();

function ringCentroid(ring: number[][]): [number, number] {
  const n = ring.length - 1;
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
  return [x / n, y / n];
}

interface Props {
  lat: number;
  lon: number;
  onScores: (scores: Record<string, number> | null) => void;
  /** Caption explaining what the coloured hexagons mean */
  legend: string;
  /** Receives a PNG snapshot of the map for the PDF */
  onImage?: (dataUrl: string) => void;
}

export default function ReportMap({ lat, lon, onScores, legend, onImage }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onScoresRef = useRef(onScores);
  const onImageRef = useRef(onImage);
  useEffect(() => { onScoresRef.current = onScores; }, [onScores]);
  useEffect(() => { onImageRef.current = onImage; }, [onImage]);

  // Current target + per-lookup resolution state, kept in refs so the single
  // idle handler always sees the latest values and each address re-arms.
  const target = useRef({ lat, lon });
  const resolved = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    return () => maplibregl.removeProtocol("pmtiles");
  }, []);

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const dark = BASEMAPS.find((b) => b.id === "tmava")?.style as string;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: dark,
      center: [lon, lat],
      zoom: 14,
      maxZoom: 18,
      attributionControl: false,
      // allow canvas snapshot for the PDF (valid at runtime, missing from types)
      preserveDrawingBuffer: true,
    } as maplibregl.MapOptions);
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("combined", { type: "vector", url: `pmtiles://${COMBINED_URL}` });
      map.addLayer({
        id: "combined-fill",
        type: "fill",
        source: "combined",
        "source-layer": "cells",
        paint: {
          "fill-color": gradientWithInput("tmava", EQUAL_BLEND) as maplibregl.ExpressionSpecification,
          "fill-opacity": FILL_OPACITY * 0.85,
          "fill-antialias": false,
        },
      });
    });

    markerRef.current = new maplibregl.Marker({ color: "#e8a030" })
      .setLngLat([lon, lat])
      .addTo(map);

    const resolve = (s: Record<string, number> | null) => {
      if (resolved.current) return;
      resolved.current = true;
      if (timer.current) clearTimeout(timer.current);
      onScoresRef.current(s);
      if (s && onImageRef.current) {
        // grab a snapshot once the render has settled
        map.once("idle", () => {
          try { onImageRef.current?.(map.getCanvas().toDataURL("image/png")); }
          catch { /* canvas not capturable */ }
        });
      }
    };

    const readScores = () => {
      if (resolved.current) return;
      const { lat: tlat, lon: tlon } = target.current;
      const raw = map.querySourceFeatures("combined", { sourceLayer: "cells" });
      if (raw.length === 0) {
        // No cells here. If the data source has finished loading, the address
        // is genuinely outside coverage → answer now instead of waiting for
        // the 15s timeout. Otherwise tiles are still loading — wait.
        if (map.isSourceLoaded("combined")) resolve(null);
        return;
      }
      let best: (typeof raw)[number] | null = null;
      let bestDist = Infinity;
      const cosLat = Math.cos(tlat * Math.PI / 180);
      for (const f of raw) {
        if (f.geometry?.type !== "Polygon") continue;
        const [flng, flat] = ringCentroid((f.geometry as GeoJSON.Polygon).coordinates[0]);
        const d = Math.hypot((flng - tlon) * cosLat, flat - tlat);
        if (d < bestDist) { bestDist = d; best = f; }
      }
      if (!best || bestDist > 0.004) { resolve(null); return; } // outside coverage
      const props = best.properties ?? {};
      // Pass every numeric property: layer scores (keyed by id) and concrete
      // metrics (keyed "n_<id>" — object counts or dB).
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(props)) {
        const n = Number(v);
        if (!Number.isNaN(n)) out[k] = n;
      }
      for (const l of LAYERS) if (!(l.id in out)) out[l.id] = 0;
      resolve(out);
    };

    map.on("idle", readScores);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // new address → re-arm the lookup and fly there
  useEffect(() => {
    target.current = { lat, lon };
    resolved.current = false;
    if (timer.current) clearTimeout(timer.current);
    // safety net so the UI never hangs if tiles stall
    timer.current = setTimeout(() => {
      if (!resolved.current) { resolved.current = true; onScoresRef.current(null); }
    }, 15000);

    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.setLngLat([lon, lat]);
    // jumpTo (no animation) so scores resolve as soon as tiles load
    map.jumpTo({ center: [lon, lat], zoom: 14 });
  }, [lat, lon]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {/* Caption: the hexagons show overall area quality (same as the score) */}
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2 bg-[#0b0d12]/85 border border-[var(--border)] px-2.5 py-1.5 pointer-events-none">
        <span
          className="w-10 h-1.5 rounded-sm"
          style={{ background: "linear-gradient(to right, #1a3a3a, #1d7c48, #52b146, #d2e022, #fcd230)" }}
        />
        <span className="text-[9px] font-body text-[var(--text-muted)] leading-tight">{legend}</span>
      </div>
    </div>
  );
}
