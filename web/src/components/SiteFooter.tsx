"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

export default function SiteFooter() {
  const locale = useLocale();
  const t = useTranslations("footer");
  const pathname = usePathname();
  if (pathname.endsWith("/map")) return null;
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg)] px-5 py-6 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 text-[11px] font-body text-[var(--text-faint)] sm:flex-row sm:items-center sm:justify-between">
        <p>{t("beta")}</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t("linksLabel")}>
          <Link className="hover:text-[var(--accent)] transition-colors" href={`/${locale}/methodology`}>{t("methodology")}</Link>
          <Link className="hover:text-[var(--accent)] transition-colors" href={`/${locale}/privacy`}>{t("privacy")}</Link>
        </nav>
      </div>
    </footer>
  );
}
