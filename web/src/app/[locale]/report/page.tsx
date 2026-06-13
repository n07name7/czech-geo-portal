"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import NavBar from "@/components/NavBar";
import { LAYERS } from "@/lib/layers";
import { geocode, type GeocodeResult } from "@/lib/geocode";
import { REPORT_PRICE_CZK, PAYMENTS_VISIBLE } from "@/lib/payment";

const ReportMap = dynamic(() => import("@/components/ReportMap"), { ssr: false });

function scoreColor(v: number): string {
  // dark green → amber, matching the map gradient
  if (v >= 0.8) return "#fcd230";
  if (v >= 0.6) return "#d2e022";
  if (v >= 0.4) return "#52b146";
  if (v >= 0.2) return "#1d7c48";
  return "#1a3a3a";
}

export default function ReportPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [scores, setScores] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [paidSession, setPaidSession] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Query value for which search must NOT run (set by a selection or the
  // paid-return restore) — deterministic regardless of effect timing.
  const skipQuery = useRef<string | null>(null);

  // Returning from checkout: ?paid=<session>&address=<label> — restore the
  // report by re-geocoding the address and selecting it, so the unlocked
  // download button appears.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paid = params.get("paid");
    if (!paid) return;
    setPaidSession(paid);
    const addr = params.get("address");
    if (!addr) return;
    skipQuery.current = addr;
    setQuery(addr);
    setLoading(true);
    geocode(addr).then((rs) => {
      if (rs[0]) setSelected(rs[0]);
      else setLoading(false);
    });
  }, []);

  const startCheckout = async (mode: "payment" | "subscription") => {
    setBuying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, address: selected?.label, locale }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setBuying(false);
    }
  };

  const downloadPdf = async () => {
    const res = await fetch("/api/report/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: selected?.label ?? query, scores, session: paidSession }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "report.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    // don't re-search a value that a selection or restore just set
    if (query === skipQuery.current) return;
    if (query.trim().length < 3) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setResults(await geocode(query));
      setOpen(true);
    }, 300);
  }, [query]);

  const select = (r: GeocodeResult) => {
    skipQuery.current = r.label;
    setSelected(r);
    setQuery(r.label);
    setOpen(false);
    setResults([]);
    setScores(null);
    setLoading(true);
  };

  useEffect(() => { if (scores) setLoading(false); }, [scores]);

  const overall = useMemo(() => {
    if (!scores) return 0;
    const vals = LAYERS.map((l) => scores[l.id] ?? 0);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [scores]);

  const ranked = useMemo(() => {
    if (!scores) return [];
    return LAYERS
      .map((l) => ({ id: l.id, label: t(l.labelKey), value: scores[l.id] ?? 0 }))
      .sort((a, b) => b.value - a.value);
  }, [scores, t]);

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col">
      <NavBar />
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl text-[var(--text)] mb-2">{t("report.title")}</h1>
        <p className="font-body text-[var(--text-muted)] mb-6 max-w-2xl">{t("report.subtitle")}</p>

        {/* Address search */}
        <div className="relative max-w-xl mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder={t("report.placeholder")}
            className="w-full bg-[var(--card)] border border-[var(--border)] px-4 py-3 text-sm font-body text-[var(--text)] placeholder-[var(--text-faint)] outline-none focus:border-[var(--accent)] transition-colors"
          />
          {open && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-30 bg-[var(--surface)] border border-t-0 border-[var(--border)] max-h-64 overflow-y-auto">
              {results.map((r, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => { e.preventDefault(); select(r); }}
                  className="block w-full text-left px-4 py-2.5 text-sm font-body text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--card)] border-b border-[var(--border)] last:border-0 transition-colors"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!selected && (
          <p className="font-body text-sm text-[var(--text-faint)]">{t("report.hint")}</p>
        )}

        {selected && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Map */}
            <div className="h-72 md:h-[28rem] border border-[var(--border)] overflow-hidden">
              <ReportMap lat={selected.lat} lon={selected.lon} onScores={setScores} />
            </div>

            {/* Report */}
            <div>
              {loading && (
                <p className="font-body text-sm text-[var(--text-faint)]">{t("report.loading")}</p>
              )}
              {!loading && scores && (
                <>
                  {/* Overall */}
                  <div className="flex items-end gap-3 mb-6">
                    <span
                      className="font-display text-6xl leading-none"
                      style={{ color: scoreColor(overall) }}
                    >
                      {Math.round(overall * 100)}
                    </span>
                    <div className="pb-1">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] font-body">
                        {t("report.overall")}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] font-body">/ 100</div>
                    </div>
                  </div>

                  {/* Bars */}
                  <div className="space-y-2 mb-6">
                    {ranked.map((r) => (
                      <div key={r.id} className="flex items-center gap-3">
                        <span className="w-28 text-[11px] font-body text-[var(--text-muted)] truncate">
                          {r.label}
                        </span>
                        <div className="flex-1 h-2 bg-[var(--card)] overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{ width: `${r.value * 100}%`, background: scoreColor(r.value) }}
                          />
                        </div>
                        <span className="w-7 text-right text-[11px] font-body text-[var(--text-faint)] tabular-nums">
                          {Math.round(r.value * 100)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* PDF purchase / download */}
                  <div className="border border-[var(--accent)] border-opacity-40 p-4 bg-[var(--card)]">
                    <p className="font-body text-sm text-[var(--text)] mb-1">{t("report.pdfTitle")}</p>
                    <p className="font-body text-xs text-[var(--text-muted)] mb-3">{t("report.pdfDesc")}</p>
                    {!PAYMENTS_VISIBLE ? (
                      <button
                        disabled
                        className="px-4 py-2 text-xs font-body uppercase tracking-[0.16em] bg-[var(--accent)] text-[#0b0d12] opacity-50 cursor-not-allowed"
                      >
                        {t("report.pdfSoon")}
                      </button>
                    ) : paidSession ? (
                      <button
                        onClick={downloadPdf}
                        className="px-4 py-2 text-xs font-body uppercase tracking-[0.16em] bg-[var(--accent)] text-[#0b0d12] hover:opacity-90 transition-opacity"
                      >
                        {t("report.pdfDownload")}
                      </button>
                    ) : (
                      <button
                        onClick={() => startCheckout("payment")}
                        disabled={buying}
                        className="px-4 py-2 text-xs font-body uppercase tracking-[0.16em] bg-[var(--accent)] text-[#0b0d12] hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {buying ? t("report.pdfWait") : t("report.pdfBuy", { price: REPORT_PRICE_CZK })}
                      </button>
                    )}
                    {PAYMENTS_VISIBLE && (
                      <p className="mt-3 text-[10px] font-body text-[var(--text-faint)]">
                        {t("report.proHint")}{" "}
                        <button
                          onClick={() => startCheckout("subscription")}
                          className="underline hover:text-[var(--accent)] transition-colors"
                        >
                          {t("report.proLink")}
                        </button>
                      </p>
                    )}
                  </div>
                </>
              )}
              {!loading && !scores && (
                <p className="font-body text-sm text-[var(--text-faint)]">{t("report.noData")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
