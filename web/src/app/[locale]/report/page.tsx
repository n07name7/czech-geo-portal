"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import NavBar from "@/components/NavBar";
import { LAYERS, COMBINED_URL } from "@/lib/layers";
import { CITIES } from "@/lib/cities";
import { geocode, reverseGeocode, type GeocodeResult } from "@/lib/geocode";
import { REPORT_PRICE_CZK, PAYMENTS_VISIBLE } from "@/lib/payment";
import { buildDecisionSummary, PROFILE_IDS, type ReportProfileId } from "@/lib/report-insights";

const ReportMap = dynamic(() => import("@/components/ReportMap"), { ssr: false });
const IsochroneMap = dynamic(() => import("@/components/IsochroneMap"), { ssr: false });
const PickMap = dynamic(() => import("@/components/PickMap"), { ssr: false });

// Categories behind the paywall — the "how good" depth, vs the free "what's around".
const PREMIUM_LAYERS = new Set<string>(["highschool", "air"]);

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
  const [showPicker, setShowPicker] = useState(false);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [scores, setScores] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [paidSession, setPaidSession] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [nearby, setNearby] = useState<Record<string, { name: string; dist: number; min: number }> | null>(null);
  const [flood, setFlood] = useState<number | null>(null);
  const [flags, setFlags] = useState<Record<string, { dist: number }> | null>(null);
  const [extrasLoading, setExtrasLoading] = useState(false);
  const [isoArea, setIsoArea] = useState<{ walk?: number; drive?: number }>({});
  const [profile, setProfile] = useState<ReportProfileId>("balanced");
  const mapImageRef = useRef<string | null>(null);
  const isoWalkRef = useRef<string | null>(null);
  const isoDriveRef = useRef<string | null>(null);
  const averagesRef = useRef<Record<string, Record<string, number>> | null>(null);

  // city averages for the PDF "vs city" comparison (loaded once)
  useEffect(() => {
    fetch(`${COMBINED_URL.replace("combined.pmtiles", "averages.json").split("?")[0]}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { averagesRef.current = d; })
      .catch(() => {});
  }, []);

  // named "what's nearby" lookup (live OSM query for this one address)
  useEffect(() => {
    if (!selected) { setNearby(null); setFlood(null); setFlags(null); return; }
    let cancelled = false;
    setNearby(null);
    setFlood(null);
    setFlags(null);
    isoWalkRef.current = null;
    isoDriveRef.current = null;
    setIsoArea({});
    setExtrasLoading(true);
    const coords = JSON.stringify({ lat: selected.lat, lon: selected.lon });
    const pNearby = fetch("/api/nearby", { method: "POST", headers: { "Content-Type": "application/json" }, body: coords })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => { if (!cancelled) setNearby(d ?? {}); })
      .catch(() => { if (!cancelled) setNearby({}); });
    const pFlood = fetch("/api/flood", { method: "POST", headers: { "Content-Type": "application/json" }, body: coords })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { category?: number }) => { if (!cancelled) setFlood(typeof d?.category === "number" ? d.category : null); })
      .catch(() => { if (!cancelled) setFlood(null); });
    const pFlags = fetch("/api/flags", { method: "POST", headers: { "Content-Type": "application/json" }, body: coords })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => { if (!cancelled) setFlags(d ?? {}); })
      .catch(() => { if (!cancelled) setFlags({}); });
    // Gate the PDF button until the live lookups (slow Overpass calls) finish, so
    // the report never downloads with a half-empty section.
    Promise.allSettled([pNearby, pFlood, pFlags]).then(() => { if (!cancelled) setExtrasLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  const nearestCity = useMemo(() => {
    if (!selected) return null;
    let best = CITIES[0];
    let bestD = Infinity;
    for (const c of CITIES) {
      const d = Math.hypot(c.center[0] - selected.lon, c.center[1] - selected.lat);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }, [selected]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Query value for which search must NOT run (set by a selection or the
  // paid-return restore) — deterministic regardless of effect timing.
  const skipQuery = useRef<string | null>(null);

  // Returning from checkout or arriving from the landing search: restore a
  // selected place from the URL so the visitor lands in a real report, not an
  // empty second form. Coordinates avoid a redundant geocoder request.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paid = params.get("paid");
    if (paid) setPaidSession(paid);
    const addr = params.get("address");
    if (!addr) return;
    skipQuery.current = addr;
    setQuery(addr);
    setLoading(true);
    const lat = Number(params.get("lat"));
    const lon = Number(params.get("lon"));
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      setSelected({ label: addr, lat, lon });
      return;
    }
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

  const downloadPdf = () => {
    // A normal form navigation lets mobile browsers honor the server's
    // Content-Disposition: attachment response. Hidden iframes can silently
    // discard downloads on mobile even when the PDF endpoint succeeds.
    const cityAvg = nearestCity ? averagesRef.current?.[nearestCity.id] : undefined;
    const payload = {
      address: selected?.label ?? query,
      scores,
      session: paidSession ?? "mock_preview", // free preview while payments are off
      mapImage: mapImageRef.current,
      cityAvg,
      cityName: nearestCity?.name,
      nearby,
      rent,
      rentCity,
      rentQuarter: rentMeta?.rentQuarter,
      isoWalk: isoWalkRef.current ? { img: isoWalkRef.current, area: isoArea.walk } : undefined,
      isoDrive: isoDriveRef.current ? { img: isoDriveRef.current, area: isoArea.drive } : undefined,
      flood: flood ?? undefined,
      flags: flags ?? undefined,
    };
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/report/pdf";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payload);
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    form.remove();

    // brief feedback while the server builds the file (no completion signal
    // from a form submit, so reset after a short delay)
    setDownloading(true);
    window.setTimeout(() => setDownloading(false), 3500);
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

  // Point chosen by clicking the map → reverse-geocode for a label, then run
  // the exact same report pipeline as an address search.
  const handlePick = (lat: number, lon: number) => {
    setLoading(true);
    setScores(null);
    reverseGeocode(lat, lon).then((r) => select(r));
  };

  // ReportMap resolves with scores or null (outside coverage / timeout);
  // either way the lookup is done.
  const handleScores = (s: Record<string, number> | null) => {
    setScores(s);
    setLoading(false);
  };

  const overall = useMemo(() => {
    if (!scores) return 0;
    const vals = LAYERS.map((l) => scores[l.id] ?? 0);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [scores]);

  // Rent level (CZK/m²/month) for the address's cadastral area — official
  // MF ČR rent map, carried per cell in the combined tiles.
  const rent = scores?.rent && scores.rent > 0 ? Math.round(scores.rent) : null;
  const rentCity = nearestCity
    ? (averagesRef.current?.[nearestCity.id] as Record<string, number> | undefined)?.rent
    : undefined;
  const rentMeta = (averagesRef.current as unknown as { _meta?: { rentQuarter?: string } } | null)?._meta;
  const decision = useMemo(() => buildDecisionSummary({
    scores: scores ?? {},
    profile,
    nearby,
    flags,
    rent,
    rentCity,
    locale: locale === "en" ? "en" : "cs",
  }), [scores, profile, nearby, flags, rent, rentCity, locale]);

  // Concrete metric per layer. The 800 m radius is stated once above the
  // list, so rows stay compact: bare count for POIs, dB for noise,
  // incidents/year for safety.
  const metricText = (id: string, n: number): string => {
    if (id === "quiet") return n > 0 ? `${n} dB` : t("report.quietZone");
    if (id === "safety") return `${n} ${t("report.incidents")}`;
    if (id === "highschool") return n > 0 ? `${n}${t("report.percentile")}` : "—";
    if (id === "air") return n > 0 ? `${n} µg/m³` : "—";
    return `${n}`;
  };

  const ranked = useMemo(() => {
    if (!scores) return [];
    return LAYERS
      .map((l) => ({
        id: l.id,
        label: t(l.labelKey),
        value: scores[l.id] ?? 0,
        count: scores[`n_${l.id}`] ?? 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [scores, t]);

  // Premium is open to everyone while payments aren't active yet (preview era);
  // once Stripe keys are set (PAYMENTS_VISIBLE), it locks behind a purchase.
  const unlocked = !!paidSession || !PAYMENTS_VISIBLE;
  // "quiet" (noise) is PDF-only now — shown there in detail (day/night). It's
  // still in `scores`, so the PDF and overall score are unaffected.
  const freeRows = ranked.filter((r) => !PREMIUM_LAYERS.has(r.id) && r.id !== "quiet");
  const premiumRows = ranked.filter((r) => PREMIUM_LAYERS.has(r.id));

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

        {/* Or pick a point on the map */}
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="-mt-4 mb-6 text-xs font-body text-[var(--text-muted)] hover:text-[var(--accent)] underline underline-offset-2 transition-colors"
        >
          {showPicker ? t("report.pickHide") : t("report.pickOpen")}
        </button>
        {showPicker && (
          <div className="mb-8">
            <p className="text-[11px] font-body text-[var(--text-faint)] mb-2">{t("report.pickHint")}</p>
            <div className="h-80 border border-[var(--border)] overflow-hidden">
              <PickMap lat={selected?.lat} lon={selected?.lon} onPick={handlePick} />
            </div>
          </div>
        )}

        {!selected && !showPicker && (
          <p className="font-body text-sm text-[var(--text-faint)]">{t("report.hint")}</p>
        )}

        {selected && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Map */}
            <div className="h-72 md:h-[28rem] border border-[var(--border)] overflow-hidden">
              <ReportMap lat={selected.lat} lon={selected.lon} onScores={handleScores} legend={t("report.mapLegend")} onImage={(img) => { mapImageRef.current = img; }} />
            </div>

            {/* Report */}
            <div>
              {loading && (
                <div>
                  <p className="font-body text-sm text-[var(--text-faint)] mb-3">{t("report.loading")}</p>
                  <div className="h-1 w-full bg-[var(--card)] overflow-hidden rounded">
                    <div className="h-full w-1/3 bg-[var(--accent)] rounded animate-[loadingbar_1.1s_ease-in-out_infinite]" />
                  </div>
                </div>
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
                      <div className="text-[10px] text-[var(--text-faint)] font-body">{t("report.scoreCtx")}</div>
                    </div>
                  </div>

                  {/* Decision-first view: profiles make the score mean something for a real move. */}
                  <section className="mb-6 border-y border-[var(--border)] py-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-body text-[var(--accent)] mb-2">
                      {t("report.profileTitle")}
                    </p>
                    <p className="text-xs font-body text-[var(--text-muted)] mb-3">{t("report.profileLead")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PROFILE_IDS.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setProfile(id)}
                          aria-pressed={profile === id}
                          className={`min-h-11 border px-3 py-2.5 text-left transition-colors ${profile === id
                            ? "border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--text)]"
                            : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text)]"}`}
                        >
                          <span className="block text-xs font-body font-medium">{t(`report.profile.${id}.label`)}</span>
                          <span className="block mt-0.5 text-[10px] font-body opacity-75 leading-snug">{t(`report.profile.${id}.desc`)}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="mb-6 border border-[var(--accent)] border-opacity-40 bg-[var(--card)] p-4">
                    <div className="flex items-end justify-between gap-4 mb-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] font-body text-[var(--accent)]">{t("report.decisionTitle")}</p>
                        <p className="mt-1 text-sm font-body text-[var(--text)] leading-snug">{decision.verdict}</p>
                      </div>
                      <span className="font-display text-3xl leading-none text-[var(--accent)] tabular-nums">{decision.profileScore}</span>
                    </div>
                    {(decision.strengths.length > 0 || decision.watchOuts.length > 0) && (
                      <div className="grid gap-4 sm:grid-cols-2 text-[11px] font-body leading-snug">
                        <div>
                          <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-[#7bc46f]">{t("report.strengths")}</p>
                          {decision.strengths.length > 0 ? <ul className="space-y-1.5 text-[var(--text-muted)]">{decision.strengths.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="text-[var(--text-faint)]">—</p>}
                        </div>
                        <div>
                          <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-[#e59067]">{t("report.watchOuts")}</p>
                          {decision.watchOuts.length > 0 ? <ul className="space-y-1.5 text-[var(--text-muted)]">{decision.watchOuts.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="text-[var(--text-faint)]">—</p>}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Concrete evidence belongs on the web page too, not only inside a downloaded PDF. */}
                  {!extrasLoading && (rent || nearby) && (
                    <section className="mb-6 grid gap-3 sm:grid-cols-2">
                      {typeof rent === "number" && (
                        <div className="border border-[var(--border)] bg-[var(--surface)] p-4">
                          <p className="text-[10px] uppercase tracking-[0.16em] font-body text-[var(--text-faint)]">{t("report.rentTitle")}</p>
                          <p className="mt-2 font-display text-2xl text-[var(--text)] tabular-nums">{rent.toLocaleString(locale)} <span className="text-xs font-body text-[var(--text-muted)]">{t("report.rentUnit")}</span></p>
                          {typeof rentCity === "number" && rentCity > 0 && (
                            <p className={`mt-1 text-[11px] font-body ${rent <= rentCity ? "text-[#7bc46f]" : "text-[#e59067]"}`}>
                              {Math.abs(Math.round(((rent - rentCity) / rentCity) * 100))} % {rent <= rentCity ? t("report.rentBelow") : t("report.rentAbove")} · {nearestCity?.name}
                            </p>
                          )}
                        </div>
                      )}
                      {nearby && (
                        <div className="border border-[var(--border)] bg-[var(--surface)] p-4">
                          <p className="text-[10px] uppercase tracking-[0.16em] font-body text-[var(--text-faint)]">{t("report.nearbyTitle")}</p>
                          <div className="mt-2 space-y-1.5">
                            {Object.entries(nearby).slice(0, 3).map(([category, place]) => (
                              <div key={category} className="flex items-baseline justify-between gap-3 text-[11px] font-body">
                                <span className="min-w-0 truncate text-[var(--text-muted)]"><span className="text-[var(--text-faint)]">{t(`report.nearCat.${category}`)} · </span>{place.name}</span>
                                <span className="shrink-0 text-[var(--text)] tabular-nums">{place.min} {t("report.nearWalk")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {/* Rent is shown above and carried into the PDF below as well. */}

                  {/* Per-category rows: concrete number + score bar */}
                  <p className="text-[10px] font-body text-[var(--text-faint)] mb-2">
                    {t("report.radiusNote")}
                  </p>
                  <div className="space-y-2.5 mb-4">
                    {freeRows.map((r) => (
                      <div key={r.id} className="flex items-center gap-3">
                        <span className="w-28 text-[11px] font-body text-[var(--text-muted)] truncate">
                          {r.label}
                        </span>
                        <div className="flex-1 h-1.5 bg-[var(--card)] overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{ width: `${r.value * 100}%`, background: scoreColor(r.value) }}
                          />
                        </div>
                        <span className="w-24 text-right text-[11px] font-body text-[var(--text)] tabular-nums">
                          {metricText(r.id, r.count)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Premium categories — locked teaser until unlocked */}
                  {premiumRows.length > 0 && (
                    <div className="mb-6 border-t border-[var(--border)] pt-3">
                      <p className="text-[9px] font-body uppercase tracking-[0.18em] text-[var(--accent)] mb-2.5">
                        {!PAYMENTS_VISIBLE ? t("report.premiumFree") : t("report.premiumTitle")}
                      </p>
                      <div className="space-y-2.5">
                        {premiumRows.map((r) => (
                          <div key={r.id} className="flex items-center gap-3">
                            <span className="w-28 text-[11px] font-body text-[var(--text-muted)] truncate">
                              {r.label}
                            </span>
                            <div className="flex-1 h-1.5 bg-[var(--card)] overflow-hidden">
                              <div
                                className={`h-full transition-all ${unlocked ? "" : "blur-[3px] opacity-60"}`}
                                style={{
                                  width: `${(unlocked ? r.value : 0.6) * 100}%`,
                                  background: unlocked ? scoreColor(r.value) : "var(--text-faint)",
                                }}
                              />
                            </div>
                            <span className="w-24 text-right text-[11px] font-body text-[var(--text)] tabular-nums">
                              {unlocked ? metricText(r.id, r.count) : "🔒"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* "Co máte v okolí" and the reach maps are PDF-only — the
                      data is still fetched/captured below and passed to the PDF. */}

                  {/* PDF purchase / download */}
                  <div className="border border-[var(--accent)] border-opacity-40 p-4 bg-[var(--card)]">
                    <p className="font-body text-sm text-[var(--text)] mb-1">{t("report.pdfTitle")}</p>
                    <p className="font-body text-xs text-[var(--text-muted)] mb-2.5">{t("report.pdfDesc")}</p>
                    <ul className="mb-4 space-y-1.5">
                      {(["rent", "nearby", "reach", "flags", "env", "city"] as const).map((k) => (
                        <li key={k} className="flex items-start gap-2 text-[11px] font-body text-[var(--text-muted)] leading-snug">
                          <span className="text-[var(--accent)] leading-none mt-[1px]">✓</span>
                          <span>{t(`report.feat.${k}`)}</span>
                        </li>
                      ))}
                    </ul>
                    {!PAYMENTS_VISIBLE ? (
                      // Payments not active yet — offer the PDF as a free preview
                      <button
                        onClick={downloadPdf}
                        disabled={downloading || extrasLoading}
                        className="px-4 py-2 text-xs font-body uppercase tracking-[0.16em] bg-[var(--accent)] text-[#0b0d12] hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {extrasLoading ? t("report.pdfPreparing") : downloading ? t("report.pdfWait") : t("report.pdfFree")}
                      </button>
                    ) : paidSession ? (
                      <button
                        onClick={downloadPdf}
                        disabled={downloading || extrasLoading}
                        className="px-4 py-2 text-xs font-body uppercase tracking-[0.16em] bg-[var(--accent)] text-[#0b0d12] hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {extrasLoading ? t("report.pdfPreparing") : t("report.pdfDownload")}
                      </button>
                    ) : (
                      <button
                        onClick={() => startCheckout("payment")}
                        disabled={buying}
                        className="px-4 py-2 text-xs font-body uppercase tracking-[0.16em] bg-[var(--accent)] text-[#0b0d12] hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {buying ? t("report.pdfWait") : t("report.unlock", { price: REPORT_PRICE_CZK })}
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

        {/* Reach maps render off-screen only to capture PNGs for the PDF —
            they are intentionally not shown on the web page. */}
        {selected && scores && (
          <div aria-hidden style={{ position: "absolute", left: -10000, top: 0, pointerEvents: "none" }}>
            {([["walk", "#52b146"], ["drive", "#5b9bd5"]] as const).map(([mode, color]) => (
              <div key={`${selected.label}-${mode}`} style={{ width: 560, height: 320 }}>
                <IsochroneMap
                  lat={selected.lat}
                  lon={selected.lon}
                  mode={mode}
                  color={color}
                  onImage={(img) => { if (mode === "walk") isoWalkRef.current = img; else isoDriveRef.current = img; }}
                  onMeta={(m) => setIsoArea((prev) => ({ ...prev, [mode]: m?.areaKm2 }))}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
