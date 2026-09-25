import { useLocale, useTranslations } from "next-intl";
import NavBar from "@/components/NavBar";
import { getMethodologyContent } from "@/lib/methodology-content";

export default function MethodologyPage() {
  const locale = useLocale();
  const t = useTranslations("methodology");
  const content = getMethodologyContent(locale);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar />
      <main className="max-w-3xl mx-auto px-5 sm:px-14 py-12 sm:py-16 space-y-14 sm:space-y-16">
        <div className="border-b border-[var(--border)] pb-8">
          <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--accent)] font-body block mb-4">
            {content.eyebrow}
          </span>
          <h1 className="font-display text-4xl sm:text-5xl text-[var(--text)]">{t("title")}</h1>
        </div>

        <section className="space-y-4">
          <h2 className="font-display text-2xl text-[var(--text)]">{t("aboutTitle")}</h2>
          <p className="font-body text-[var(--text-muted)] leading-relaxed">{t("aboutText")}</p>
        </section>

        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="font-display text-2xl text-[var(--text)]">{t("sourcesTitle")}</h2>
          </div>
          <div className="border border-[var(--border)] overflow-x-auto rounded-sm">
            <table className="w-full min-w-[620px] text-[13px] sm:text-sm font-body">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  {content.columns.map((column) => (
                    <th key={column} className="text-left px-3 sm:px-5 py-3 text-[10px] tracking-[0.16em] uppercase text-[var(--text-muted)] font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {content.sources.map((row, index) => (
                  <tr key={row.id} className={`border-b border-[var(--border)] last:border-0 ${index % 2 === 0 ? "bg-[var(--card)]" : "bg-[var(--surface)]"}`}>
                    <td className="px-3 sm:px-5 py-3 text-[var(--text)]">{row.layer}</td>
                    <td className="px-3 sm:px-5 py-3 text-[var(--text-muted)]">{row.source}</td>
                    <td className="px-3 sm:px-5 py-3 text-[var(--text-muted)]">{row.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="font-display text-2xl text-[var(--text)]">{t("scoringTitle")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 border border-[var(--border)]">
            {content.steps.map((step, index) => (
              <div key={step} className="bg-[var(--card)] px-4 py-4 text-xs font-body text-[var(--text-muted)] border-b last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 border-[var(--border)]">
                <span className="text-[var(--accent)] font-medium mr-2">{String(index + 1).padStart(2, "0")}</span>
                {step}
              </div>
            ))}
          </div>
          <p className="font-body text-[var(--text-muted)] leading-relaxed">{t("scoringText")}</p>
          <div className="border-l-2 border-[var(--accent)] pl-4">
            <p className="font-body text-xs text-[var(--text-faint)] leading-relaxed">{content.technicalNote}</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl text-[var(--text)]">{t("matchTitle")}</h2>
          <p className="font-body text-[var(--text-muted)] leading-relaxed">{t("matchText")}</p>
        </section>

        <section className="border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7 space-y-3">
          <h2 className="font-display text-xl text-[var(--text)]">{content.limitsTitle}</h2>
          <p className="font-body text-sm text-[var(--text-muted)] leading-relaxed">{content.limits}</p>
        </section>
      </main>
    </div>
  );
}
