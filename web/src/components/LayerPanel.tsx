"use client";
import { useTranslations } from "next-intl";
import type { LayerId, LayerConfig } from "@/types";
import LayerToggle from "./LayerToggle";

interface Props {
  layers: LayerConfig[];
  activeLayer: LayerId;
  onLayerChange: (id: LayerId) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function LayerPanel({
  layers,
  activeLayer,
  onLayerChange,
  collapsed,
  onToggle,
}: Props) {
  const t = useTranslations();
  return (
    <div className="absolute top-16 left-0 z-10 flex items-start">
      {/* Panel */}
      <div
        className={`bg-white/95 rounded-r-xl shadow-lg transition-all duration-300 overflow-hidden ${
          collapsed ? "w-0 opacity-0" : "w-52 opacity-100"
        }`}
      >
        <div className="p-3 w-52">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2 px-1">
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
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="mt-2 bg-white/95 shadow-lg rounded-r-lg px-1.5 py-3 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white transition-colors"
        aria-label={collapsed ? "Expand layers" : "Collapse layers"}
      >
        <span className="text-xs">{collapsed ? "›" : "‹"}</span>
      </button>
    </div>
  );
}
