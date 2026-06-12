"use client";
import { useTranslations } from "next-intl";
import type { BasemapId } from "@/types";
import { BASEMAPS } from "@/lib/basemaps";

interface Props {
  activeBasemap: BasemapId;
  onChange: (basemap: BasemapId) => void;
}

export default function BasemapSwitcher({ activeBasemap, onChange }: Props) {
  const t = useTranslations("basemap");
  return (
    <div
      className="absolute right-4 z-10 flex flex-col border border-[var(--border)]"
      style={{ bottom: "calc(2.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
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
