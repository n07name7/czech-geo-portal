"use client";
import { useTranslations } from "next-intl";
import type { BasemapId } from "@/types";
import { BASEMAPS } from "@/lib/basemaps";

interface Props {
  activeBasemap: BasemapId;
  onChange: (basemap: BasemapId) => void;
  hexVisible: boolean;
  onHexToggle: () => void;
}

export default function BasemapSwitcher({ activeBasemap, onChange, hexVisible, onHexToggle }: Props) {
  const t = useTranslations("basemap");
  const tUi = useTranslations("ui");
  return (
    <div
      className="absolute right-4 z-10 flex flex-col border border-[var(--border)]"
      style={{ bottom: "calc(2.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {/* Hex overlay toggle — top row of the control group */}
      <button
        onClick={onHexToggle}
        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] tracking-widest uppercase font-body font-medium transition-colors border-b border-[var(--border)] ${
          hexVisible
            ? "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--card)]"
            : "bg-[var(--surface)] text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--card)]"
        }`}
        aria-pressed={!hexVisible}
        title={hexVisible ? tUi("hideHex") : tUi("showHex")}
      >
        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
          <path
            d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z"
            stroke="currentColor"
            strokeWidth="1.4"
            fill={hexVisible ? "currentColor" : "none"}
            fillOpacity={hexVisible ? 0.2 : 0}
          />
          {!hexVisible && (
            <line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1.4" />
          )}
        </svg>
        <span>{hexVisible ? tUi("hideHex") : tUi("showHex")}</span>
      </button>
      {BASEMAPS.map((bm) => (
        <button
          key={bm.id}
          onClick={() => onChange(bm.id)}
          className={`px-3 py-1.5 text-[10px] tracking-widest uppercase font-body font-medium transition-colors border-b border-[var(--border)] last:border-b-0 ${
            activeBasemap === bm.id
              ? "bg-[var(--accent)] text-[#0b0d12]"
              : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--card)]"
          }`}
        >
          {t(bm.id)}
        </button>
      ))}
    </div>
  );
}
