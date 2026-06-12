"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { LayerId, BasemapId } from "@/types";
import { LAYERS } from "@/lib/layers";
import { BASEMAPS, DEFAULT_BASEMAP } from "@/lib/basemaps";
import { CITIES, DEFAULT_CITY } from "@/lib/cities";
import { LEGEND_GRADIENT_CSS } from "@/lib/map-config";
import type { CityConfig } from "@/lib/cities";
import LayerPanel from "@/components/LayerPanel";
import Legend from "@/components/Legend";
import NavBar from "@/components/NavBar";
import BasemapSwitcher from "@/components/BasemapSwitcher";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[var(--bg)] flex items-center justify-center">
      <span className="font-body text-xs tracking-widest uppercase text-[var(--text-faint)]">
        Načítání mapy…
      </span>
    </div>
  ),
});

export default function MapPage() {
  const [activeLayer, setActiveLayer] = useState<LayerId>("schools");
  const [activeCity, setActiveCity] = useState<CityConfig>(DEFAULT_CITY);
  const [collapsed, setCollapsed] = useState(true); // start collapsed; expand on desktop after mount
  useEffect(() => {
    setCollapsed(window.innerWidth < 768);
  }, []);
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>(DEFAULT_BASEMAP.id);
  const t = useTranslations();

  const currentBasemapStyle =
    BASEMAPS.find((b) => b.id === activeBasemap)?.style ?? DEFAULT_BASEMAP.style;

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <NavBar floating />
      <MapView
        activeLayer={activeLayer}
        basemap={currentBasemapStyle}
        basemapId={activeBasemap}
        activeCity={activeCity}
      />
      <LayerPanel
        layers={LAYERS}
        activeLayer={activeLayer}
        onLayerChange={setActiveLayer}
        cities={CITIES}
        activeCity={activeCity}
        onCityChange={setActiveCity}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <Legend
        labelLow={t("legend.low")}
        labelHigh={t("legend.high")}
        gradientCss={LEGEND_GRADIENT_CSS[activeBasemap] ?? LEGEND_GRADIENT_CSS.tmava}
      />
      <BasemapSwitcher activeBasemap={activeBasemap} onChange={setActiveBasemap} />
    </main>
  );
}
