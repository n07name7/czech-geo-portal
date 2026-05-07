"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { LayerId, BasemapId } from "@/types";
import { LAYERS } from "@/lib/layers";
import { BASEMAPS, DEFAULT_BASEMAP } from "@/lib/basemaps";
import LayerPanel from "@/components/LayerPanel";
import Legend from "@/components/Legend";
import NavBar from "@/components/NavBar";
import BasemapSwitcher from "@/components/BasemapSwitcher";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-500">
      Načítání mapy…
    </div>
  ),
});

export default function MapPage() {
  const [activeLayer, setActiveLayer] = useState<LayerId>("schools");
  const [collapsed, setCollapsed] = useState(false);
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>(DEFAULT_BASEMAP.id);
  const t = useTranslations();

  const currentBasemapStyle =
    BASEMAPS.find((b) => b.id === activeBasemap)?.style ?? DEFAULT_BASEMAP.style;

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <NavBar floating />
      <MapView activeLayer={activeLayer} basemap={currentBasemapStyle} />
      <LayerPanel
        layers={LAYERS}
        activeLayer={activeLayer}
        onLayerChange={setActiveLayer}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <Legend labelLow={t("legend.low")} labelHigh={t("legend.high")} />
      <BasemapSwitcher activeBasemap={activeBasemap} onChange={setActiveBasemap} />
    </main>
  );
}
