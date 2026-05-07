"use client";
import { useTranslations } from "next-intl";
import type { LayerId, LayerConfig } from "@/types";
import type { CityConfig } from "@/lib/cities";
import LayerToggle from "./LayerToggle";

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
  layers,
  activeLayer,
  onLayerChange,
  cities,
  activeCity,
  onCityChange,
  collapsed,
  onToggle,
}: Props) {
  const t = useTranslations();
  return (
    <div className="absolute top-12 left-0 z-10 flex items-start">
      {/* Panel */}
      <div
        className={`bg-[var(--surface)] border-r border-b border-[var(--border)] transition-all duration-300 overflow-hidden ${
          collapsed ? "w-0 opacity-0" : "w-52 opacity-100"
        }`}
      >
        <div className="w-52">
          {/* City selector */}
          <div className="border-b border-[var(--border)] p-3">
            <p className="text-[9px] font-body font-medium text-[var(--accent)] uppercase tracking-[0.22em] mb-2 px-1">
              {t("ui.city")}
            </p>
            <div className="space-y-0.5">
              {cities.map((city) => (
                <button
                  key={city.id}
                  onClick={() => onCityChange(city)}
                  className={`flex items-center gap-3 w-full px-3 py-1.5 text-left transition-colors text-xs font-body ${
                    activeCity.id === city.id
                      ? "text-[var(--accent)] bg-[var(--accent-glow)] border-l-2 border-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--card)] border-l-2 border-transparent"
                  }`}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>

          {/* Layer selector */}
          <div className="p-3">
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
                  onClick={() => onLayerChange(layer.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="mt-2 bg-[var(--surface)] border border-l-0 border-[var(--border)] px-1.5 py-3 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--card)] transition-colors"
        aria-label={collapsed ? "Expand panel" : "Collapse panel"}
      >
        <span className="text-xs">{collapsed ? "›" : "‹"}</span>
      </button>
    </div>
  );
}
