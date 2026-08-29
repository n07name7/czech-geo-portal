"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import NavBar from "@/components/NavBar";
import { geocode, type GeocodeResult } from "@/lib/geocode";
import { compareAddresses } from "@/lib/comparison";
import { PROFILE_IDS, type ReportProfileId } from "@/lib/report-insights";
import { buildReportHref } from "@/lib/report-link";

const ReportMap = dynamic(() => import("@/components/ReportMap"), { ssr: false });

type SlotProps = { label: string; place: GeocodeResult | null; onSelect: (place: GeocodeResult | null) => void };

function AddressSlot({ label, place, onSelect }: SlotProps) {
  const t = useTranslations("compare");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 3) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const found = await geocode(query);
      setResults(found);
      setOpen(true);
    }, 260);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  if (place) {
    return (
      <div className="border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-[10px] uppercase tracking-[0.16em] font-body text-[var(--accent)]">{label}</p>
        <p className="mt-2 text-sm font-body text-[var(--text)] leading-snug">{place.label}</p>
        <button type="button" onClick={() => { onSelect(null); setQuery(""); }} className="mt-3 text-[11px] font-body text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--accent)]">{t("change")}</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="mb-2 block text-[10px] uppercase tracking-[0.16em] font-body text-[var(--text-faint)]">{label}</label>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={t("placeholder")}
        className="w-full border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-body text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]"
      />
      {open && results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 border border-t-0 border-[var(--border)] bg-[var(--surface)] shadow-xl">
          {results.map((result) => <button type="button" key={`${result.label}-${result.lat}-${result.lon}`} onMouseDown={(e) => { e.preventDefault(); onSelect(result); setOpen(false); }} className="block w-full border-b border-[var(--border)] px-4 py-3 text-left text-sm font-body text-[var(--text-muted)] last:border-0 hover:bg-[var(--card)] hover:text-[var(--text)]">{result.label}</button>)}
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  const t = useTranslations();
  const locale = useLocale();
  const [a, setA] = useState<GeocodeResult | null>(null);
  const [b, setB] = useState<GeocodeResult | null>(null);
  const [aScores, setAScores] = useState<Record<string, number> | null>(null);
  const [bScores, setBScores] = useState<Record<string, number> | null>(null);
  const [profile, setProfile] = useState<ReportProfileId>("balanced");

  const selectA = (place: GeocodeResult | null) => { setA(place); setAScores(null); };
  const selectB = (place: GeocodeResult | null) => { setB(place); setBScores(null); };
  const comparison = aScores && bScores ? compareAddresses({ a: aScores, b: bScores, profile, locale: locale === "en" ? "en" : "cs" }) : null;

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <NavBar />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-[10px] uppercase tracking-[0.22em] font-body text-[var(--accent)]">{t("compare.eyebrow")}</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl text-[var(--text)] sm:text-5xl">{t("compare.title")}</h1>
        <p className="mt-4 max-w-2xl font-body text-sm leading-relaxed text-[var(--text-muted)]">{t("compare.lead")}</p>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <AddressSlot label={t("compare.addressA")} place={a} onSelect={selectA} />
          <AddressSlot label={t("compare.addressB")} place={b} onSelect={selectB} />
        </section>

        {(a || b) && (
          <section className="mt-8 border-y border-[var(--border)] py-5">
            <p className="text-[10px] uppercase tracking-[0.16em] font-body text-[var(--accent)]">{t("report.profileTitle")}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROFILE_IDS.map((id) => <button key={id} type="button" onClick={() => setProfile(id)} className={`min-h-11 border px-3 py-2 text-left text-xs font-body transition-colors ${profile === id ? "border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--text)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"}`}>{t(`report.profile.${id}.label`)}</button>)}
            </div>
          </section>
        )}

        {(a || b) && (
          <section className="mt-8 grid gap-5 md:grid-cols-2">
            {([['a', a, aScores, setAScores], ['b', b, bScores, setBScores]] as const).map(([id, place, scores, setScores]) => place && (
              <article key={id} className={`border bg-[var(--surface)] ${comparison?.winner === id ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
                <div className="flex items-center justify-between gap-4 p-4">
                  <div><p className="text-[10px] uppercase tracking-[0.16em] font-body text-[var(--text-faint)]">{id === "a" ? t("compare.addressA") : t("compare.addressB")}</p><p className="mt-1 text-sm font-body text-[var(--text)]">{place.label}</p></div>
                  {scores && <span className="font-display text-4xl text-[var(--accent)]">{comparison ? (id === "a" ? comparison.a : comparison.b) : "…"}</span>}
                </div>
                <div className="h-56 border-y border-[var(--border)]"><ReportMap lat={place.lat} lon={place.lon} onScores={setScores} legend={t("report.mapLegend")} /></div>
                <div className="p-4"><Link className="text-xs font-body text-[var(--accent)] underline underline-offset-4" href={buildReportHref(locale, place)}>{t("compare.openReport")}</Link></div>
              </article>
            ))}
          </section>
        )}

        {comparison && (
          <section className="mt-6 border border-[var(--accent)] bg-[var(--card)] p-5">
            <p className="text-[10px] uppercase tracking-[0.16em] font-body text-[var(--accent)]">{t("compare.recommendation")}</p>
            <p className="mt-2 max-w-3xl text-base font-body leading-relaxed text-[var(--text)]">{comparison.reason}</p>
          </section>
        )}
      </div>
    </main>
  );
}
