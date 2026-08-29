"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { geocode, type GeocodeResult } from "@/lib/geocode";
import { buildReportHref } from "@/lib/report-link";

export default function AddressStart() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 3) { setResults([]); setOpen(false); setSearching(false); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      const found = await geocode(query);
      setResults(found);
      setOpen(true);
      setSearching(false);
    }, 260);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  const choose = (place: GeocodeResult) => router.push(buildReportHref(locale, place));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results[0]) choose(results[0]);
  };

  return (
    <form onSubmit={submit} className="relative w-full max-w-xl" role="search">
      <label htmlFor="address-start" className="sr-only">{t("searchLabel")}</label>
      <div className="flex border border-[var(--accent)] bg-[var(--surface)] shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
        <input
          id="address-start"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={t("searchPlaceholder")}
          autoComplete="street-address"
          className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm font-body text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
        />
        <button
          type="submit"
          disabled={!results.length}
          className="shrink-0 bg-[var(--accent)] px-4 sm:px-5 text-xs font-body font-semibold uppercase tracking-[0.12em] text-[#0b0d12] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {searching ? t("searching") : t("searchCta")}
        </button>
      </div>
      {open && results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 border border-t-0 border-[var(--border)] bg-[var(--surface)] shadow-xl">
          {results.map((place) => (
            <button
              type="button"
              key={`${place.label}-${place.lat}-${place.lon}`}
              onMouseDown={(e) => { e.preventDefault(); choose(place); }}
              className="block w-full border-b border-[var(--border)] px-4 py-3 text-left text-sm font-body text-[var(--text-muted)] transition-colors last:border-b-0 hover:bg-[var(--card)] hover:text-[var(--text)]"
            >
              {place.label}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] font-body text-[var(--text-faint)]">{t("searchNote")}</p>
    </form>
  );
}
