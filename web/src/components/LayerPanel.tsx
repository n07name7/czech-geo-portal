"use client";
import { useTranslations } from "next-intl";
import type { LayerId, LayerConfig } from "@/types";
import LayerToggle from "./LayerToggle";

interface Props {
  layers: LayerConfig[];
  activeLayer: LayerId;
  onLayerChange: (id: LayerId) => void;
}

export default function LayerPanel({ layers, activeLayer, onLayerChange }: Props) {
  const t = useTranslations();
  return (
    <div className="absolute top-4 left-4 bg-white/95 rounded-xl shadow-lg p-3 w-52 z-10">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
        {t("ui.layers")}
      </p>
      <div className="space-y-0.5">
        {layers.map((layer) => (
          <LayerToggle
            key={layer.id}
            layer={layer}
            active={layer.id === activeLayer}
            label={t(layer.labelKey)}
            onClick={() => onLayerChange(layer.id)}
          />
        ))}
      </div>
    </div>
  );
}
