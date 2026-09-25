import NavBar from "@/components/NavBar";
import { getPrivacyContent } from "@/lib/privacy-content";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const content = getPrivacyContent(locale);
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-14 sm:py-16">
        <header className="border-b border-[var(--border)] pb-8">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--accent)] font-body">{content.eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl text-[var(--text)]">{content.title}</h1>
          <p className="mt-4 max-w-2xl font-body text-[var(--text-muted)] leading-relaxed">{content.lead}</p>
          <p className="mt-4 text-[10px] uppercase tracking-[0.14em] font-body text-[var(--text-faint)]">{content.updated}</p>
        </header>
        <div className="mt-10 space-y-10">
          {content.sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="font-display text-2xl text-[var(--text)]">{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph} className="font-body text-sm sm:text-base leading-relaxed text-[var(--text-muted)]">{paragraph}</p>)}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
