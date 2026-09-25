"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("error");
  return (
    <main className="min-h-[70vh] flex items-center justify-center bg-[var(--bg)] px-4">
      <section role="alert" className="w-full max-w-lg border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
        <p className="font-display text-2xl text-[var(--text)]">{t("title")}</p>
        <p className="mt-3 font-body text-sm leading-relaxed text-[var(--text-muted)]">{t("description")}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="border border-[var(--accent)] px-4 py-2 font-body text-sm text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[#0b0d12]"
          >
            {t("retry")}
          </button>
          <Link
            href="/"
            className="border border-[var(--border)] px-4 py-2 font-body text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {t("home")}
          </Link>
        </div>
      </section>
    </main>
  );
}
