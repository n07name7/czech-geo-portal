"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";

interface Props {
  floating?: boolean;
}

export default function NavBar({ floating = false }: Props) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  const bgClass = floating
    ? "absolute top-0 inset-x-0 z-20 bg-[#0b0d12]/80 backdrop-blur-md border-b border-white/5"
    : "bg-[var(--bg)] border-b border-[var(--border)]";

  const linkCls = (href: string) =>
    `text-xs tracking-widest uppercase font-medium transition-colors whitespace-nowrap ${
      isActive(href)
        ? "text-[var(--accent)]"
        : "text-[var(--text-muted)] hover:text-[var(--text)]"
    }`;

  return (
    <nav className={`${bgClass} h-12 flex items-center px-4 sm:px-6 gap-4 sm:gap-8`}>
      <Link
        href={`/${locale}`}
        className="font-display text-[var(--text)] text-sm tracking-widest uppercase mr-auto truncate"
      >
        <span className="hidden xs:inline">Kam v Česku?</span>
        <span className="xs:hidden">KvČ</span>
      </Link>

      <Link href={`/${locale}/map`} className={linkCls(`/${locale}/map`)}>
        {t("map")}
      </Link>

      {/* Hide on very small screens */}
      <Link
        href={`/${locale}/methodology`}
        className={`${linkCls(`/${locale}/methodology`)} hidden sm:inline`}
      >
        {t("methodology")}
      </Link>

      <LanguageSwitcher />
    </nav>
  );
}
