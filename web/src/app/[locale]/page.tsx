import Link from "next/link";
import { useTranslations } from "next-intl";
import { getLocale } from "next-intl/server";
import NavBar from "@/components/NavBar";
import { LAYERS } from "@/lib/layers";

// ─── Hex-grid math ─────────────────────────────────────────────────────────────

const HEX_R = 21;          // circumradius (center → corner)
const HEX_COLS = 9;
const HEX_ROWS = 12;
const COL_STEP = HEX_R * 1.5;
const ROW_STEP = HEX_R * Math.sqrt(3);

type HexCell = { cx: number; cy: number; score: number };

function buildGrid(): HexCell[] {
  const hotspots = [
    { r: HEX_ROWS * 0.28, c: HEX_COLS * 0.52, w: 1.0 },
    { r: HEX_ROWS * 0.50, c: HEX_COLS * 0.30, w: 0.52 },
    { r: HEX_ROWS * 0.42, c: HEX_COLS * 0.74, w: 0.46 },
    { r: HEX_ROWS * 0.68, c: HEX_COLS * 0.58, w: 0.30 },
  ];
  const sigma = HEX_ROWS * 0.22;

  return Array.from({ length: HEX_COLS * HEX_ROWS }, (_, idx) => {
    const col = Math.floor(idx / HEX_ROWS);
    const row = idx % HEX_ROWS;
    const cx = col * COL_STEP + HEX_R;
    const cy = row * ROW_STEP + (col % 2) * (ROW_STEP / 2) + ROW_STEP / 2;

    const raw = hotspots.reduce((acc, h) => {
      const dr = (row - h.r) / sigma;
      const dc = (col - h.c) / (sigma * 0.78);
      return acc + h.w * Math.exp(-(dr * dr + dc * dc) / 2);
    }, 0);

    const noise =
      Math.sin(col * 2.1 + row * 1.3) * 0.065 +
      Math.cos(col * 0.85 - row * 2.7) * 0.045;

    return { cx, cy, score: Math.max(0.04, Math.min(1, raw / 1.08 + noise)) };
  });
}

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

function scoreToFill(s: number): string {
  if (s < 0.12) return "#111820";
  if (s < 0.28) return "#162d22";
  if (s < 0.44) return "#1d5c38";
  if (s < 0.60) return "#388c42";
  if (s < 0.74) return "#79b025";
  if (s < 0.87) return "#c49020";
  return "#e8a030";
}

function HexMapViz() {
  const cells = buildGrid();
  const svgW = (HEX_COLS - 1) * COL_STEP + 2 * HEX_R;
  const svgH = (HEX_ROWS - 1) * ROW_STEP + ROW_STEP + HEX_R;

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        maskImage:
          "radial-gradient(ellipse 88% 80% at 50% 48%, black 38%, transparent 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 88% 80% at 50% 48%, black 38%, transparent 100%)",
      }}
    >
      <svg
        viewBox={`0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        style={{ animation: "hexGlow 4s ease-in-out infinite" }}
      >
        <defs>
          <radialGradient id="heroGlow" cx="52%" cy="36%" r="48%">
            <stop offset="0%" stopColor="#e8a030" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#e8a030" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect
          width={svgW}
          height={svgH}
          fill="url(#heroGlow)"
        />
        {cells.map(({ cx, cy, score }, i) => (
          <polygon
            key={i}
            points={hexPoints(cx, cy, HEX_R - 1.5)}
            fill={scoreToFill(score)}
            fillOpacity={Math.max(0.18, score * 0.9 + 0.1)}
            stroke="#e8a030"
            strokeOpacity={score > 0.6 ? 0.18 : 0.06}
            strokeWidth="0.5"
          />
        ))}
      </svg>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const locale = await getLocale();

  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-x-hidden">
      <NavBar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-[calc(100vh-48px)] flex flex-col lg:flex-row items-center"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 72% 42%, rgba(232,160,48,0.055) 0%, transparent 70%), #0b0d12",
        }}
      >
        {/* Left — text */}
        <div
          className="flex-1 flex flex-col justify-center px-8 sm:px-14 lg:px-20 py-20 lg:py-0 z-10"
          style={{ animation: "fadeUp 0.7s ease both" }}
        >
          <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--accent)] font-body mb-6 block">
            Praha · Infrastruktura
          </span>

          <h1 className="font-display text-[clamp(3.2rem,7vw,6rem)] leading-[0.95] text-[var(--text)] mb-6">
            <HeroHeadline />
          </h1>

          <div className="w-10 h-px bg-[var(--accent)] mb-6 opacity-70" />

          <p className="font-body text-base text-[var(--text-muted)] max-w-sm leading-relaxed mb-10">
            <HeroSub />
          </p>

          <div className="flex flex-wrap gap-3 mb-12">
            <Link
              href={`/${locale}/map`}
              className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[#0b0d12] font-body font-semibold text-sm px-6 py-3 rounded-none transition-colors"
            >
              <CtaLabel />
              <span className="text-base leading-none">→</span>
            </Link>
            <Link
              href={`/${locale}/methodology`}
              className="inline-flex items-center gap-2 border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-muted)] hover:text-[var(--accent)] font-body text-sm px-6 py-3 rounded-none transition-colors"
            >
              <MetodLabel />
            </Link>
          </div>

          <div className="flex gap-6 text-[11px] tracking-wider text-[var(--text-faint)] font-body uppercase">
            <span>9 vrstev dat</span>
            <span className="text-[var(--border)]">·</span>
            <span>H3 rozlišení 10</span>
            <span className="text-[var(--border)]">·</span>
            <span>OSM zdroj</span>
          </div>
        </div>

        {/* Right — hex visualization */}
        <div
          className="flex-1 w-full lg:w-auto h-[340px] lg:h-[calc(100vh-48px)] relative"
          style={{ animation: "fadeUp 0.9s ease 0.15s both" }}
        >
          <HexMapViz />
        </div>
      </section>

      {/* ── Layers grid ───────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] py-24 px-8 sm:px-14 lg:px-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-baseline gap-6 mb-14">
            <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--accent)] font-body">
              Data
            </span>
            <h2 className="font-display text-3xl text-[var(--text)]">
              <LayersTitle />
            </h2>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-px bg-[var(--border)]">
            {LAYERS.map((layer) => (
              <LayerTile key={layer.id} icon={layer.icon} labelKey={layer.labelKey} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] py-24 px-8 sm:px-14 lg:px-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-baseline gap-6 mb-16">
            <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--accent)] font-body">
              Postup
            </span>
            <h2 className="font-display text-3xl text-[var(--text)]">
              <HowTitle />
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12">
            <StepBlock num="01" labelKey="landing.step1Label" descKey="landing.step1Desc" />
            <StepBlock num="02" labelKey="landing.step2Label" descKey="landing.step2Desc" />
            <StepBlock num="03" labelKey="landing.step3Label" descKey="landing.step3Desc" />
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] py-8 px-8 sm:px-14 lg:px-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <span className="font-display text-sm text-[var(--text-faint)] tracking-wider uppercase">
          Kam v Česku?
        </span>
        <span className="font-body text-xs text-[var(--text-faint)]">
          Data © OpenStreetMap contributors · <Link href={`/${locale}/methodology`} className="hover:text-[var(--accent)] transition-colors">Metodologie</Link>
        </span>
      </footer>
    </div>
  );
}

// ─── Translation sub-components ────────────────────────────────────────────────

function HeroHeadline() {
  const t = useTranslations("landing");
  const headline = t("headline"); // "Kde bydlet v Praze?"
  const parts = headline.split(" v ");
  return parts.length === 2 ? (
    <>
      {parts[0]}
      <br />v{" "}
      <span style={{ color: "var(--accent)" }}>{parts[1]}</span>
    </>
  ) : (
    <>{headline}</>
  );
}

function HeroSub() {
  const t = useTranslations("landing");
  return <>{t("subheadline")}</>;
}

function CtaLabel() {
  const t = useTranslations("landing");
  return <>{t("cta")}</>;
}

function MetodLabel() {
  return <>Metodologie</>;
}

function LayersTitle() {
  const t = useTranslations("landing");
  return <>{t("layersTitle")}</>;
}

function HowTitle() {
  const t = useTranslations("landing");
  return <>{t("howTitle")}</>;
}

function LayerTile({ icon, labelKey }: { icon: string; labelKey: string }) {
  const t = useTranslations();
  return (
    <div className="bg-[var(--card)] hover:bg-[var(--surface)] group transition-colors px-5 py-6 flex flex-col items-start gap-3 cursor-default">
      <span className="text-2xl leading-none">{icon}</span>
      <span className="font-body text-xs text-[var(--text-muted)] group-hover:text-[var(--text)] leading-snug transition-colors">
        {t(labelKey)}
      </span>
    </div>
  );
}

function StepBlock({
  num,
  labelKey,
  descKey,
}: {
  num: string;
  labelKey: string;
  descKey: string;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-4">
      <span
        className="font-display leading-none select-none"
        style={{
          fontSize: "clamp(4rem, 8vw, 6.5rem)",
          color: "transparent",
          WebkitTextStroke: "1px var(--accent)",
          opacity: 0.55,
        }}
      >
        {num}
      </span>
      <h3 className="font-display text-xl text-[var(--text)]">{t(labelKey)}</h3>
      <p className="font-body text-sm text-[var(--text-muted)] leading-relaxed">{t(descKey)}</p>
    </div>
  );
}
