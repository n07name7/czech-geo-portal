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

const DEFAULT_WEIGHTS = Object.fromEntries(
  LAYERS.map((l) => [l.id, 1]),
) as Record<LayerId, number>;

export default function MapPage() {
  const [activeLayer, setActiveLayer] = useState<LayerId>("schools");
  const [activeCity, setActiveCity] = useState<CityConfig>(DEFAULT_CITY);
  const [collapsed, setCollapsed] = useState(true); // start collapsed; expand on desktop after mount
  useEffect(() => {
    setCollapsed(window.innerWidth < 768);
  }, []);
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>(DEFAULT_BASEMAP.id);
  const [hexVisible, setHexVisible] = useState(true);
  const [matchMode, setMatchMode] = useState(false);
  const [weights, setWeights] = useState<Record<LayerId, number>>(DEFAULT_WEIGHTS);
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
        matchMode={matchMode}
        weights={weights}
        measureLabel={matchMode ? t("ui.match") : t(`layers.${activeLayer}`)}
        ratingLabel={t("legend.rating")}
        hexVisible={hexVisible}
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
        matchMode={matchMode}
        onMatchModeChange={setMatchMode}
        weights={weights}
        onWeightChange={(id, w) => setWeights((prev) => ({ ...prev, [id]: w }))}
        onResetWeights={() => setWeights(DEFAULT_WEIGHTS)}
      />
      <Legend
        labelLow={t("legend.low")}
        labelHigh={t("legend.high")}
        gradientCss={LEGEND_GRADIENT_CSS[activeBasemap] ?? LEGEND_GRADIENT_CSS.tmava}
      />
      <BasemapSwitcher activeBasemap={activeBasemap} onChange={setActiveBasemap} />

      {/* Hide / show the hexagon overlay — subtle toggle above the basemap switcher */}
      <button
        onClick={() => setHexVisible((v) => !v)}
        className="absolute right-4 z-10 w-8 h-8 flex items-center justify-center bg-[var(--surface)]/80 backdrop-blur-sm border border-[var(--border)] text-[var(--text-faint)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all duration-200 touch-manipulation"
        style={{ bottom: "calc(2.5rem + env(safe-area-inset-bottom, 0px) + 86px)" }}
        aria-pressed={!hexVisible}
        title={hexVisible ? t("ui.hideHex") : t("ui.showHex")}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={`transition-opacity duration-200 ${hexVisible ? "opacity-100" : "opacity-30"}`}>
          <path d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z" stroke="currentColor" strokeWidth="1.2" fill={hexVisible ? "currentColor" : "none"} fillOpacity={hexVisible ? 0.15 : 0} />
        </svg>
      </button>
    </main>
  );
}
