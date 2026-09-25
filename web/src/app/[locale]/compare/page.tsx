"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import NavBar from "@/components/NavBar";
import PickMap from "@/components/PickMap";
import { searchAddresses, supportedCoverageCity, type GeocodeResult, reverseGeocode } from "@/lib/geocode";
import { compareAddresses } from "@/lib/comparison";
import { buildComparisonDetails } from "@/lib/comparison-details";
import { PROFILE_IDS, type ReportProfileId } from "@/lib/report-insights";
import { buildReportHref } from "@/lib/report-link";
import { scoreStatusMessageKey, type ScoreLoadStatus } from "@/lib/score-load-status";

const ReportMap = dynamic(() => import("@/components/ReportMap"), { ssr: false });

type SlotProps = { label: string; place: GeocodeResult | null; onSelect: (place: GeocodeResult | null) => void };

function AddressSlot({ label, place, onSelect }: SlotProps) {
  const t = useTranslations("compare");
  const tReport = useTranslations("report");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 3) { setResults([]); setOpen(false); setSearchUnavailable(false); setSelectedIndex(-1); return; }
    timer.current = setTimeout(async () => {
      const found = await searchAddresses(query);
      setResults(found.status === "available" ? found.results : []);
      setSearchUnavailable(found.status === "unavailable");
      setOpen(true);
      setSelectedIndex(-1);
    }, 260);
  }, [query]);

  const handlePick = async (lat: number, lon: number) => {
    const r = await reverseGeocode(lat, lon);
    onSelect(r);
    setShowPicker(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        onSelect(results[selectedIndex]);
        setOpen(false);
      } else if (results.length > 0) {
        onSelect(results[0]);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  if (place) {
    return (
      <div className="border border-[var(--border)] bg-[var(--surface)] p-4 h-full flex flex-col justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] font-body text-[var(--accent)]">{label}</p>
          <p className="mt-2 text-sm font-body text-[var(--text)] leading-snug">{place.label}</p>
        </div>
        <button type="button" onClick={() => { onSelect(null); setQuery(""); }} className="mt-4 self-start text-[11px] font-body text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--accent)]">{t("change")}</button>
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
        onKeyDown={handleKey}
        placeholder={t("placeholder")}
        className="w-full border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-body text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]"
      />
      {open && results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 border border-t-0 border-[var(--border)] bg-[var(--surface)] shadow-xl" role="listbox">
          {results.map((result, i) => (
            <button
              type="button"
              key={`${result.label}-${result.lat}-${result.lon}`}
              role="option"
              aria-selected={i === selectedIndex}
              onMouseDown={(e) => { e.preventDefault(); onSelect(result); setOpen(false); }}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`block w-full border-b border-[var(--border)] px-4 py-3 text-left text-sm font-body transition-colors last:border-0 ${
                i === selectedIndex
                  ? "bg-[var(--card)] text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--card)] hover:text-[var(--text)]"
              }`}
            >
              {result.label}
            </button>
          ))}
        </div>
      )}
      {open && searchUnavailable && (
        <p role="alert" className="border border-t-0 border-[#e59067]/60 bg-[var(--surface)] px-4 py-3 text-xs font-body text-[#e59067]">{t("searchUnavailable")}</p>
      )}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="text-[11px] font-body text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--accent)] transition-colors"
        >
          {showPicker ? tReport("pickHide") : tReport("pickOpen")}
        </button>
      </div>
      {showPicker && (
        <div className="mt-3 h-64 border border-[var(--border)] overflow-hidden">
          <PickMap onPick={handlePick} />
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
  const [aStatus, setAStatus] = useState<ScoreLoadStatus>("idle");
  const [bStatus, setBStatus] = useState<ScoreLoadStatus>("idle");
  const [retryRevision, setRetryRevision] = useState(0);
  const [profile, setProfile] = useState<ReportProfileId>("balanced");

  const selectA = (place: GeocodeResult | null) => { 
    setA(place); setAScores(null); setAStatus(place ? "loading" : "idle");
    const url = new URL(window.location.href);
    if (place) {
      url.searchParams.set("a", place.label);
      url.searchParams.set("latA", place.lat.toString());
      url.searchParams.set("lonA", place.lon.toString());
    } else {
      url.searchParams.delete("a"); url.searchParams.delete("latA"); url.searchParams.delete("lonA");
    }
    window.history.replaceState({}, "", url);
  };
  const selectB = (place: GeocodeResult | null) => { 
    setB(place); setBScores(null); setBStatus(place ? "loading" : "idle");
    const url = new URL(window.location.href);
    if (place) {
      url.searchParams.set("b", place.label);
      url.searchParams.set("latB", place.lat.toString());
      url.searchParams.set("lonB", place.lon.toString());
    } else {
      url.searchParams.delete("b"); url.searchParams.delete("latB"); url.searchParams.delete("lonB");
    }
    window.history.replaceState({}, "", url);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const aLabel = params.get("a");
    const latA = Number(params.get("latA"));
    const lonA = Number(params.get("lonA"));
    if (aLabel && Number.isFinite(latA) && Number.isFinite(lonA)) {
      setA({ label: aLabel, lat: latA, lon: lonA });
      setAStatus("loading");
    }
    const bLabel = params.get("b");
    const latB = Number(params.get("latB"));
    const lonB = Number(params.get("lonB"));
    if (bLabel && Number.isFinite(latB) && Number.isFinite(lonB)) {
      setB({ label: bLabel, lat: latB, lon: lonB });
      setBStatus("loading");
    }
  }, []);

  const retryScores = () => {
    setAScores(null); setBScores(null);
    setAStatus(a ? "loading" : "idle");
    setBStatus(b ? "loading" : "idle");
    setRetryRevision((value) => value + 1);
  };
  const reportLocale = locale === "ru" ? "ru" : locale === "en" ? "en" : "cs";
  const cityA = supportedCoverageCity(a?.city);
  const cityB = supportedCoverageCity(b?.city);
  const comparable = cityA !== null && cityA === cityB;
  const comparison = aScores && bScores
    ? compareAddresses({ a: aScores, b: bScores, profile, locale: reportLocale, comparable })
    : null;
  const details = aScores && bScores
    ? buildComparisonDetails({ a: aScores, b: bScores, comparable })
    : [];

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <NavBar />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-[10px] uppercase tracking-[0.22em] font-body text-[var(--accent)]">{t("compare.eyebrow")}</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl text-[var(--text)] sm:text-5xl">{t("compare.title")}</h1>
        <p className="mt-4 max-w-2xl font-body text-sm leading-relaxed text-[var(--text-muted)]">{t("compare.lead")}</p>

        <section className="mt-8 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full"><AddressSlot label={t("compare.addressA")} place={a} onSelect={selectA} /></div>
          <button
            type="button"
            onClick={() => { const tmp = a; selectA(b); selectB(tmp); }}
            title="Swap"
            className="h-[46px] px-4 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors hidden md:block"
          >
            ⇄
          </button>
          <div className="flex-1 w-full"><AddressSlot label={t("compare.addressB")} place={b} onSelect={selectB} /></div>
        </section>

        {a && b && (aStatus !== "ready" || bStatus !== "ready") && (
          <section role={aStatus === "unavailable" || bStatus === "unavailable" ? "alert" : "status"} className="mt-5 border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm font-body text-[var(--text)]">
              {aStatus === "unavailable" || bStatus === "unavailable"
                ? t("compare.scoreUnavailable")
                : aStatus === "outside" || bStatus === "outside"
                  ? t("compare.scoreOutside")
                  : t("compare.scoreLoading")}
            </p>
            {(aStatus === "unavailable" || bStatus === "unavailable") && (
              <button type="button" onClick={retryScores} className="mt-3 border border-[var(--accent)] px-3 py-2 text-xs font-body text-[var(--accent)]">{t("compare.retryScores")}</button>
            )}
          </section>
        )}

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
            {([['a', a, aScores, setAScores, aStatus, setAStatus], ['b', b, bScores, setBScores, bStatus, setBStatus]] as const).map(([id, place, scores, setScores, status, setStatus]) => place && (
              <article key={id} className={`border bg-[var(--surface)] ${comparison?.winner === id ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
                <div className="flex items-center justify-between gap-4 p-4">
                  <div><p className="text-[10px] uppercase tracking-[0.16em] font-body text-[var(--text-faint)]">{id === "a" ? t("compare.addressA") : t("compare.addressB")}</p><p className="mt-1 text-sm font-body text-[var(--text)]">{place.label}</p></div>
                  {scores && <span className="font-display text-4xl text-[var(--accent)]">{comparison ? (id === "a" ? comparison.a : comparison.b) : "…"}</span>}
                </div>
                {scoreStatusMessageKey(status) && (
                  <p role={status === "unavailable" ? "alert" : "status"} className="border-t border-[var(--border)] px-4 py-3 text-xs font-body text-[var(--text-muted)]">{t(`compare.${scoreStatusMessageKey(status)}`)}</p>
                )}
                <div className="h-56 border-y border-[var(--border)]"><ReportMap key={`${id}-${place.lat}-${place.lon}-${retryRevision}`} lat={place.lat} lon={place.lon} onScores={setScores} onStatus={setStatus} legend={t("report.mapLegend")} /></div>
                <div className="p-4"><Link className="text-xs font-body text-[var(--accent)] underline underline-offset-4" href={buildReportHref(locale, place)}>{t("compare.openReport")}</Link></div>
              </article>
            ))}
          </section>
        )}

        {comparison && (
          <section className="mt-6 border border-[var(--accent)] bg-[var(--card)] p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.16em] font-body text-[var(--accent)]">{t("compare.recommendation")}</p>
            <p className="mt-2 max-w-3xl text-base font-body leading-relaxed text-[var(--text)]">{comparison.reason}</p>
          </section>
        )}

        {details.length > 0 && (
          <section className="mt-8 border-t border-[var(--border)] pt-8">
            <div className="max-w-3xl">
              <h2 className="font-display text-3xl text-[var(--text)]">{t("compare.detailsTitle")}</h2>
              <p className="mt-2 text-xs sm:text-sm font-body leading-relaxed text-[var(--text-muted)]">{t("compare.detailsLead")}</p>
            </div>
            <div className="mt-5 overflow-x-auto border border-[var(--border)]">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1fr] bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)] font-body">
                  <span>{t("compare.recommendation")}</span>
                  <span>{t("compare.addressA")}</span>
                  <span>{t("compare.addressB")}</span>
                  <span>{t("compare.detailsTitle")}</span>
                </div>
                {details.map((row) => {
                  const resultLabel = row.winner === "incomparable"
                    ? t("compare.withinCity")
                    : row.winner === "a"
                      ? t("compare.betterA")
                      : row.winner === "b"
                        ? t("compare.betterB")
                        : t("compare.close");
                  const difference = row.winner === "incomparable"
                    ? null
                    : row.kind === "rent"
                      ? t("compare.rentDiff", { value: row.difference })
                      : t("compare.scoreDiff", { value: row.difference });
                  return (
                    <div key={row.id} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1fr] items-center border-b last:border-b-0 border-[var(--border)] px-4 py-4 font-body text-sm">
                      <span className="font-medium text-[var(--text)]">{t(`compare.criterion.${row.id}`)}</span>
                      <span className={row.winner === "a" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>{row.a}{row.kind === "score" ? "/100" : " Kč"}</span>
                      <span className={row.winner === "b" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>{row.b}{row.kind === "score" ? "/100" : " Kč"}</span>
                      <span className="text-xs text-[var(--text-muted)]"><strong className="block font-medium text-[var(--text)]">{resultLabel}</strong>{difference}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
