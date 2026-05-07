import { useTranslations } from "next-intl";
import NavBar from "@/components/NavBar";

const DATA_SOURCES = [
  { layer: "Základní školy", source: "OSM Overpass", freq: "Týdně" },
  { layer: "Mateřské školy", source: "OSM Overpass", freq: "Týdně" },
  { layer: "Dětská hřiště", source: "OSM Overpass", freq: "Týdně" },
  { layer: "Lékaři / kliniky", source: "OSM Overpass", freq: "Týdně" },
  { layer: "Lékárny", source: "OSM Overpass", freq: "Týdně" },
  { layer: "Zastávky MHD", source: "OSM Overpass", freq: "Týdně" },
  { layer: "Parky", source: "OSM Overpass", freq: "Týdně" },
  { layer: "Sportoviště", source: "OSM Overpass", freq: "Týdně" },
  { layer: "Obchody s potravinami", source: "OSM Overpass", freq: "Týdně" },
];

const SCORING_STEPS = [
  "POI v okruhu 800 m",
  "Počet objektů",
  "Normalizace 0–1",
  "Barva na mapě",
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar />
      <main className="max-w-3xl mx-auto px-8 sm:px-14 py-16 space-y-16">
        <PageTitle />
        <AboutSection />
        <SourcesSection />
        <ScoringSection />
      </main>
    </div>
  );
}

function PageTitle() {
  const t = useTranslations("methodology");
  return (
    <div className="border-b border-[var(--border)] pb-8">
      <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--accent)] font-body block mb-4">
        Dokumentace
      </span>
      <h1 className="font-display text-5xl text-[var(--text)]">{t("title")}</h1>
    </div>
  );
}

function AboutSection() {
  const t = useTranslations("methodology");
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl text-[var(--text)]">{t("aboutTitle")}</h2>
      <p className="font-body text-[var(--text-muted)] leading-relaxed">{t("aboutText")}</p>
    </section>
  );
}

function SourcesSection() {
  const t = useTranslations("methodology");
  return (
    <section className="space-y-6">
      <h2 className="font-display text-2xl text-[var(--text)]">{t("sourcesTitle")}</h2>
      <div className="border border-[var(--border)]">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-5 py-3 text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)] font-medium">
                Vrstva
              </th>
              <th className="text-left px-5 py-3 text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)] font-medium">
                Zdroj
              </th>
              <th className="text-left px-5 py-3 text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)] font-medium">
                Aktualizace
              </th>
            </tr>
          </thead>
          <tbody>
            {DATA_SOURCES.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-[var(--border)] last:border-0 ${
                  i % 2 === 0 ? "bg-[var(--card)]" : "bg-[var(--surface)]"
                }`}
              >
                <td className="px-5 py-3 text-[var(--text)]">{row.layer}</td>
                <td className="px-5 py-3 text-[var(--text-muted)]">{row.source}</td>
                <td className="px-5 py-3 text-[var(--text-muted)]">{row.freq}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ScoringSection() {
  const t = useTranslations("methodology");
  return (
    <section className="space-y-6">
      <h2 className="font-display text-2xl text-[var(--text)]">{t("scoringTitle")}</h2>

      {/* Step pipeline */}
      <div className="flex items-stretch gap-0 overflow-x-auto">
        {SCORING_STEPS.map((step, i) => (
          <div key={i} className="flex items-center">
            <div className="border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-xs font-body text-[var(--text-muted)] whitespace-nowrap">
              <span className="text-[var(--accent)] font-medium mr-2">{String(i + 1).padStart(2, "0")}</span>
              {step}
            </div>
            {i < SCORING_STEPS.length - 1 && (
              <span className="text-[var(--text-faint)] px-1 text-xs flex-shrink-0">→</span>
            )}
          </div>
        ))}
      </div>

      <p className="font-body text-[var(--text-muted)] leading-relaxed">{t("scoringText")}</p>

      {/* Technical note */}
      <div className="border-l-2 border-[var(--accent)] border-opacity-40 pl-4">
        <p className="font-body text-xs text-[var(--text-faint)] leading-relaxed">
          H3 rozlišení 10 · každá buňka ≈ 150 × 150 m · okruh 800 m od středu buňky
        </p>
      </div>
    </section>
  );
}
