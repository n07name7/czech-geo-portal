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
  matchMode: boolean;
  onMatchModeChange: (on: boolean) => void;
  weights: Record<LayerId, number>;
  onWeightChange: (id: LayerId, w: number) => void;
  onResetWeights: () => void;
}

export default function LayerPanel({
  layers, activeLayer, onLayerChange,
  cities, activeCity, onCityChange,
  collapsed, onToggle,
  matchMode, onMatchModeChange,
  weights, onWeightChange, onResetWeights,
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
          collapsed ? "w-0 opacity-0" : "w-60 opacity-100"
        }`}
      >
        <div className="w-60 flex flex-col h-full overflow-hidden">
          {/* City search */}
          <div className="border-b border-[var(--border)] p-3 flex-shrink-0">
            <p className="text-[9px] font-body font-medium text-[var(--accent)] uppercase tracking-[0.22em] mb-2 px-1">
              {t("ui.city")}
            </p>
            <CitySearch cities={cities} value={activeCity} onChange={onCityChange} />
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-[var(--border)] flex-shrink-0">
            <button
              onClick={() => onMatchModeChange(false)}
              className={`flex-1 py-2.5 text-[10px] font-body font-medium uppercase tracking-[0.16em] transition-colors ${
                !matchMode
                  ? "text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--card)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {t("ui.layers")}
            </button>
            <button
              onClick={() => onMatchModeChange(true)}
              className={`flex-1 py-2.5 text-[10px] font-body font-medium uppercase tracking-[0.16em] transition-colors ${
                matchMode
                  ? "text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--card)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {t("ui.match")}
            </button>
          </div>

          {/* Body */}
          <div className="p-3 flex-1 overflow-y-auto">
            {!matchMode ? (
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
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] font-body text-[var(--text-faint)] leading-relaxed px-1">
                  {t("ui.matchHint")}
                </p>
                {layers.map((layer) => (
                  <div key={layer.id} className="px-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-body text-[var(--text-muted)]">
                        {t(layer.labelKey)}
                      </span>
                      <span className="text-[10px] font-body text-[var(--text-faint)] tabular-nums">
                        {weights[layer.id] === 0 ? "–" : `${weights[layer.id]}×`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={1}
                      value={weights[layer.id]}
                      onChange={(e) => onWeightChange(layer.id, Number(e.target.value))}
                      className="w-full accent-[var(--accent)] h-1 cursor-pointer"
                    />
                  </div>
                ))}
                <button
                  onClick={onResetWeights}
                  className="mt-2 w-full py-2 text-[10px] font-body uppercase tracking-[0.16em] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                >
                  {t("ui.reset")}
                </button>
              </div>
            )}
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
