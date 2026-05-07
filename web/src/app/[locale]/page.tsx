"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { LayerId } from "@/types";
import { LAYERS } from "@/lib/layers";
import LayerPanel from "@/components/LayerPanel";
import Legend from "@/components/Legend";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslations } from "next-intl";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-500">Načítání mapy…</div>,
});

export default function HomePage() {
  const [activeLayer, setActiveLayer] = useState<LayerId>("schools");
  const t = useTranslations();

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <MapView activeLayer={activeLayer} />
      <LayerPanel
        layers={LAYERS}
        activeLayer={activeLayer}
        onLayerChange={setActiveLayer}
      />
      <Legend labelLow={t("legend.low")} labelHigh={t("legend.high")} />
      <LanguageSwitcher />
    </main>
  );
}
