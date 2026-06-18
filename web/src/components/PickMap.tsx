"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { BASEMAPS } from "@/lib/basemaps";

interface Props {
  lat?: number;
  lon?: number;
  /** Called with the clicked coordinates */
  onPick: (lat: number, lon: number) => void;
}

/** Interactive map for choosing a point by clicking (alternative to typing an
 *  address). Reuses the site's dark basemap; emits the clicked coordinates. */
export default function PickMap({ lat, lon, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onPickRef = useRef(onPick);
  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const style = BASEMAPS.find((b) => b.id === "tmava")?.style as maplibregl.StyleSpecification;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [lon ?? 15.33, lat ?? 49.82], // whole-CZ view when nothing chosen yet
      zoom: lat != null ? 14 : 7,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    const place = (la: number, lo: number) => {
      if (markerRef.current) markerRef.current.setLngLat([lo, la]);
      else markerRef.current = new maplibregl.Marker({ color: "#e8a030" }).setLngLat([lo, la]).addTo(map);
    };
    if (lat != null && lon != null) place(lat, lon);

    map.on("click", (e) => {
      const { lng, lat: la } = e.lngLat;
      place(la, lng);
      onPickRef.current(la, lng);
    });
    map.getCanvas().style.cursor = "crosshair";

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep marker/view in sync when the point changes from the address search
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat == null || lon == null) return;
    if (markerRef.current) markerRef.current.setLngLat([lon, lat]);
    else markerRef.current = new maplibregl.Marker({ color: "#e8a030" }).setLngLat([lon, lat]).addTo(map);
    map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 13), duration: 600 });
  }, [lat, lon]);

  return <div ref={containerRef} className="w-full h-full" style={{ touchAction: "none" }} />;
}
