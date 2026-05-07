import { useTranslations } from "next-intl";
import NavBar from "@/components/NavBar";

const DATA_SOURCES = [
  { layer: "Základní školy / Primary schools / Начальные школы", source: "OSM Overpass", freq: "Týdně / Weekly" },
  { layer: "Mateřské školy / Kindergartens / Детские сады", source: "OSM Overpass", freq: "Týdně / Weekly" },
  { layer: "Dětská hřiště / Playgrounds / Площадки", source: "OSM Overpass", freq: "Týdně / Weekly" },
  { layer: "Lékaři / Clinics / Клиники", source: "OSM Overpass", freq: "Týdně / Weekly" },
  { layer: "Lékárny / Pharmacies / Аптеки", source: "OSM Overpass", freq: "Týdně / Weekly" },
  { layer: "Zastávky MHD / Transport / Транспорт", source: "OSM Overpass", freq: "Týdně / Weekly" },
  { layer: "Parky / Parks / Парки", source: "OSM Overpass", freq: "Týdně / Weekly" },
  { layer: "Sportoviště / Sports / Спорт", source: "OSM Overpass", freq: "Týdně / Weekly" },
  { layer: "Obchody / Shops / Магазины", source: "OSM Overpass", freq: "Týdně / Weekly" },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-12">
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
    <div className="border-b border-[var(--border)] pb-6">
      <h1 className="text-3xl font-bold text-[var(--text)]">{t("title")}</h1>
    </div>
  );
}

function AboutSection() {
  const t = useTranslations("methodology");
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-[var(--text)]">{t("aboutTitle")}</h2>
      <p className="text-[var(--text-muted)] leading-relaxed">{t("aboutText")}</p>
    </section>
  );
}

function SourcesSection() {
  const t = useTranslations("methodology");
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-[var(--text)]">{t("sourcesTitle")}</h2>
      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 font-semibold text-[var(--text)]">Vrstva / Layer</th>
              <th className="text-left px-4 py-3 font-semibold text-[var(--text)]">Zdroj / Source</th>
              <th className="text-left px-4 py-3 font-semibold text-[var(--text)]">Aktualizace</th>
            </tr>
          </thead>
          <tbody>
            {DATA_SOURCES.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-[var(--border)] last:border-0 ${
                  i % 2 === 0 ? "bg-white" : "bg-[var(--surface)]"
                }`}
              >
                <td className="px-4 py-3 text-[var(--text)]">{row.layer}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{row.source}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{row.freq}</td>
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
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-[var(--text)]">{t("scoringTitle")}</h2>
      <div className="flex items-center gap-2 flex-wrap text-sm font-medium">
        {["POI v okruhu 800m", "→", "Počet", "→", "Normalizace 0–1", "→", "Barva na mapě"].map(
          (step, i) => (
            <span
              key={i}
              className={
                step === "→"
                  ? "text-[var(--text-muted)]"
                  : "bg-blue-50 text-[var(--accent)] px-3 py-1.5 rounded-lg"
              }
            >
              {step}
            </span>
          )
        )}
      </div>
      <p className="text-[var(--text-muted)] leading-relaxed">{t("scoringText")}</p>
    </section>
  );
}
