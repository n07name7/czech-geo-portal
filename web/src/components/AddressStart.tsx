"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { searchAddresses, type GeocodeResult } from "@/lib/geocode";
import { buildReportHref } from "@/lib/report-link";

export default function AddressStart() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 3) { setResults([]); setOpen(false); setSearching(false); setSearchUnavailable(false); setSelectedIndex(-1); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const found = await searchAddresses(query);
      if (controller.signal.aborted) return;
      setResults(found.status === "available" ? found.results : []);
      setSearchUnavailable(found.status === "unavailable");
      setOpen(true);
      setSearching(false);
      setSelectedIndex(-1);
    }, 260);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query]);

  const choose = (place: GeocodeResult) => router.push(buildReportHref(locale, place));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      choose(results[selectedIndex]);
    } else if (results[0]) {
      choose(results[0]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
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
          onKeyDown={handleKeyDown}
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
        <div className="absolute inset-x-0 top-full z-30 border border-t-0 border-[var(--border)] bg-[var(--surface)] shadow-xl" role="listbox">
          {results.map((place, i) => (
            <button
              type="button"
              key={`${place.label}-${place.lat}-${place.lon}`}
              role="option"
              aria-selected={i === selectedIndex}
              onMouseDown={(e) => { e.preventDefault(); choose(place); }}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`block w-full border-b border-[var(--border)] px-4 py-3 text-left text-sm font-body transition-colors last:border-b-0 ${
                i === selectedIndex
                  ? "bg-[var(--card)] text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--card)] hover:text-[var(--text)]"
              }`}
            >
              {place.label}
            </button>
          ))}
        </div>
      )}
      {open && searchUnavailable && (
        <p role="alert" className="border border-t-0 border-[#e59067]/60 bg-[var(--surface)] px-4 py-3 text-xs font-body text-[#e59067]">
          {t("searchUnavailable")}
        </p>
      )}
      <p className="mt-2 text-[11px] font-body text-[var(--text-faint)]">{t("searchNote")}</p>
    </form>
  );
}
