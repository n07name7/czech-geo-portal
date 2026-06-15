import { useTranslations } from "next-intl";
import NavBar from "@/components/NavBar";

const DATA_SOURCES = [
  { layer: "Základní školy", source: "Rejstřík škol MŠMT + RÚIAN (ČÚZK)", freq: "Týdně" },
  { layer: "Mateřské školy", source: "Rejstřík škol MŠMT + RÚIAN (ČÚZK)", freq: "Týdně" },
  { layer: "Dětská hřiště", source: "OpenStreetMap (ODbL)", freq: "Týdně" },
  { layer: "Lékaři / kliniky", source: "NRPZS / ÚZIS ČR (CC BY 4.0)", freq: "Týdně" },
  { layer: "Lékárny", source: "NRPZS / ÚZIS ČR (CC BY 4.0)", freq: "Týdně" },
  { layer: "Zastávky MHD", source: "OpenStreetMap (ODbL)", freq: "Týdně" },
  { layer: "Parky", source: "OpenStreetMap (ODbL)", freq: "Týdně" },
  { layer: "Sportoviště", source: "OpenStreetMap (ODbL)", freq: "Týdně" },
  { layer: "Obchody s potravinami", source: "OpenStreetMap (ODbL)", freq: "Týdně" },
  { layer: "Klid (hluk)", source: "Strategické hlukové mapy 2022, MZ ČR", freq: "Týdně" },
  { layer: "Bezpečnost", source: "Mapa kriminality, Policie ČR (12 měsíců)", freq: "Týdně" },
  { layer: "Kvalita SŠ", source: "Přijímací zkoušky CERMAT + Rejstřík škol MŠMT", freq: "Ročně" },
  { layer: "Kvalita ovzduší", source: "Pětileté průměry PM2.5, ČHMÚ (1×1 km)", freq: "Ročně" },
  { layer: "Nájemné", source: "Cenová mapa nájemního bydlení, MF ČR (CC BY 4.0)", freq: "Čtvrtletně" },
  { layer: "Hluk den / noc", source: "Strategické hlukové mapy 2022 (Lden/Lnight), MZ ČR", freq: "Týdně" },
  { layer: "Povodňové riziko", source: "Povodňové ohrožení 2019, CENIA (dir. 2007/60/ES)", freq: "Dle aktualizace" },
  { layer: "Dostupnost (pěšky/autem)", source: "Silniční síť OpenStreetMap (Valhalla)", freq: "Live" },
  { layer: "Co je v okolí / rizika", source: "OpenStreetMap (ODbL)", freq: "Live" },
];

const SCORING_STEPS = [
  "Buňky H3 (~150 m)",
  "Skóre dle typu vrstvy",
  "Normalizace 0–1 ve městě",
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
        <MatchSection />
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
          Základní rozlišení H3 10 (buňka ≈ 150 × 150 m); při oddálení se zobrazují
          větší buňky. Okruh 800 m od středu buňky.
        </p>
      </div>
    </section>
  );
}

function MatchSection() {
  const t = useTranslations("methodology");
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl text-[var(--text)]">{t("matchTitle")}</h2>
      <p className="font-body text-[var(--text-muted)] leading-relaxed">{t("matchText")}</p>
    </section>
  );
}
