"use client";
import { useTranslations } from "next-intl";
import type { LayerId, LayerConfig } from "@/types";
import type { CityConfig } from "@/lib/cities";
import LayerToggle from "./LayerToggle";
import CitySearch from "./CitySearch";

interface Props {
  layers: LayerConfig[];
  activeLayer: LayerId;
  onLayerChange: (id: LayerId) => void;
  cities: CityConfig[];
  activeCity: CityConfig;
  onCityChange: (city: CityConfig) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function LayerPanel({
  layers, activeLayer, onLayerChange,
  cities, activeCity, onCityChange,
  collapsed, onToggle,
}: Props) {
  const t = useTranslations();

  return (
    <div className="absolute top-12 left-0 z-20 flex items-start h-[calc(100vh-48px)]">
      {/* Mobile backdrop */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/40 md:hidden z-10"
          onClick={onToggle}
        />
      )}

      {/* Panel */}
      <div
        className={`relative z-20 bg-[var(--surface)] border-r border-[var(--border)] h-full flex flex-col transition-all duration-300 overflow-hidden ${
          collapsed ? "w-0 opacity-0" : "w-56 opacity-100"
        }`}
      >
        <div className="w-56 flex flex-col h-full overflow-hidden">
          {/* City search */}
          <div className="border-b border-[var(--border)] p-3 flex-shrink-0">
            <p className="text-[9px] font-body font-medium text-[var(--accent)] uppercase tracking-[0.22em] mb-2 px-1">
              {t("ui.city")}
            </p>
            <CitySearch cities={cities} value={activeCity} onChange={onCityChange} />
          </div>

          {/* Layer selector — scrollable if many layers */}
          <div className="p-3 flex-1 overflow-y-auto">
            <p className="text-[9px] font-body font-medium text-[var(--accent)] uppercase tracking-[0.22em] mb-2 px-1">
              {t("ui.layers")}
            </p>
            <div className="space-y-0.5">
              {layers.map((layer) => (
                <LayerToggle
                  key={layer.id}
                  layer={layer}
                  active={layer.id === activeLayer}
                  label={t(layer.labelKey)}
                  onClick={() => { onLayerChange(layer.id); }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toggle button — larger tap target on mobile */}
      <button
        onClick={onToggle}
        className="relative z-20 mt-3 bg-[var(--surface)] border border-l-0 border-[var(--border)] flex items-center justify-center w-6 py-4 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--card)] active:bg-[var(--card)] transition-colors touch-manipulation"
        aria-label={collapsed ? "Otevřít panel" : "Zavřít panel"}
      >
        <span className="text-xs leading-none">{collapsed ? "›" : "‹"}</span>
      </button>
    </div>
  );
}
