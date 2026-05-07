"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";

interface Props {
  floating?: boolean; // true = transparent + backdrop-blur (map page)
}

export default function NavBar({ floating = false }: Props) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  const navClass = floating
    ? "absolute top-0 left-0 right-0 z-20 bg-white/80 backdrop-blur-sm border-b border-white/20"
    : "bg-white border-b border-[var(--border)]";

  const linkClass = (href: string) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      isActive(href)
        ? "bg-[var(--accent)] text-white"
        : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]"
    }`;

  return (
    <nav className={`${navClass} h-12 flex items-center px-4 gap-4`}>
      <Link
        href={`/${locale}`}
        className="font-bold text-[var(--text)] text-sm tracking-tight mr-auto"
      >
        🗺 Kam v Česku?
      </Link>
      <Link href={`/${locale}/map`} className={linkClass(`/${locale}/map`)}>
        {t("map")}
      </Link>
      <Link
        href={`/${locale}/methodology`}
        className={linkClass(`/${locale}/methodology`)}
      >
        {t("methodology")}
      </Link>
      <LanguageSwitcher />
    </nav>
  );
}
