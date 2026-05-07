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
    <div className="absolute bottom-24 right-3 z-10 flex flex-col gap-1">
      {BASEMAPS.map((bm) => (
        <button
          key={bm.id}
          onClick={() => onChange(bm.id)}
          className={`px-2.5 py-1 text-xs font-medium rounded-lg shadow transition-colors ${
            activeBasemap === bm.id
              ? "bg-[var(--accent)] text-white"
              : "bg-white/95 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white"
          }`}
        >
          {t(bm.id)}
        </button>
      ))}
    </div>
  );
}
