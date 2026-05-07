import Link from "next/link";
import { useTranslations } from "next-intl";
import { getLocale } from "next-intl/server";
import NavBar from "@/components/NavBar";
import { LAYERS } from "@/lib/layers";

export default async function LandingPage() {
  const locale = await getLocale();
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 flex flex-col items-center text-center gap-6">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-[var(--accent)] text-sm font-medium px-3 py-1 rounded-full">
          🗺 Praha · MVP
        </div>
        <h1 className="text-5xl font-bold text-[var(--text)] leading-tight tracking-tight">
          <HeroHeadline />
        </h1>
        <p className="text-lg text-[var(--text-muted)] max-w-xl">
          <HeroSubheadline />
        </p>
        <Link
          href={`/${locale}/map`}
          className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm"
        >
          <CtaText /> →
        </Link>

        {/* Map preview placeholder */}
        <div className="w-full max-w-3xl h-64 rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-blue-50 via-green-50 to-yellow-50 flex items-center justify-center mt-4 border border-[var(--border)]">
          <span className="text-6xl">🗺</span>
        </div>
      </section>

      {/* Layers grid */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <SectionTitle translationKey="landing.layersTitle" />
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-8">
          {LAYERS.map((layer) => (
            <LayerCard key={layer.id} icon={layer.icon} labelKey={layer.labelKey} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[var(--surface)] border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <SectionTitle translationKey="landing.howTitle" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-8">
            <StepCard num={1} labelKey="landing.step1Label" descKey="landing.step1Desc" />
            <StepCard num={2} labelKey="landing.step2Label" descKey="landing.step2Desc" />
            <StepCard num={3} labelKey="landing.step3Label" descKey="landing.step3Desc" />
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-6 text-center text-sm text-[var(--text-muted)]">
        Data © OpenStreetMap contributors · Built with ♥
      </footer>
    </div>
  );
}

function HeroHeadline() {
  const t = useTranslations("landing");
  return <>{t("headline")}</>;
}

function HeroSubheadline() {
  const t = useTranslations("landing");
  return <>{t("subheadline")}</>;
}

function CtaText() {
  const t = useTranslations("landing");
  return <>{t("cta")}</>;
}

function SectionTitle({ translationKey }: { translationKey: string }) {
  const t = useTranslations();
  return (
    <h2 className="text-2xl font-bold text-[var(--text)] text-center">
      {t(translationKey)}
    </h2>
  );
}

function LayerCard({ icon, labelKey }: { icon: string; labelKey: string }) {
  const t = useTranslations();
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-[var(--border)] hover:shadow-sm transition-shadow">
      <span className="text-2xl">{icon}</span>
      <span className="text-xs text-center text-[var(--text-muted)] font-medium leading-tight">
        {t(labelKey)}
      </span>
    </div>
  );
}

function StepCard({
  num,
  labelKey,
  descKey,
}: {
  num: number;
  labelKey: string;
  descKey: string;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col items-center text-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm">
        {num}
      </div>
      <h3 className="font-semibold text-[var(--text)]">{t(labelKey)}</h3>
      <p className="text-sm text-[var(--text-muted)]">{t(descKey)}</p>
    </div>
  );
}
