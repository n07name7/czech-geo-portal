"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";

interface Props {
  floating?: boolean;
}

export default function NavBar({ floating = false }: Props) {
  const t = useTranslations("nav");
  const tLanding = useTranslations("landing");
  const locale = useLocale();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

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

  const links = [
    { href: `/${locale}/map`, label: t("map"), alwaysVisible: true },
    { href: `/${locale}/compare`, label: t("compare"), alwaysVisible: false },
    { href: `/${locale}/report`, label: t("report"), alwaysVisible: true },
    { href: `/${locale}/methodology`, label: t("methodology"), alwaysVisible: false },
  ];

  return (
    <>
      <nav className={`${bgClass} h-12 flex items-center px-4 sm:px-6 gap-4 sm:gap-8`}>
        <Link
          href={`/${locale}`}
          className="font-display text-[var(--text)] text-sm tracking-widest uppercase mr-auto truncate"
        >
          <span className="hidden xs:inline">{tLanding("headline")}</span>
          <span className="xs:hidden">{tLanding("brandShort")}</span>
        </Link>

        {/* Desktop links */}
        {links.map(({ href, label, alwaysVisible }) => (
          <Link
            key={href}
            href={href}
            className={`${linkCls(href)} ${alwaysVisible ? "" : "hidden sm:inline"}`}
          >
            {label}
          </Link>
        ))}

        <LanguageSwitcher />

        {/* Mobile burger button - only shows when some links are hidden */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="sm:hidden flex flex-col gap-[3px] justify-center w-6 h-6 text-[var(--text-muted)]"
          aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
          aria-expanded={menuOpen}
        >
          <span className={`block h-[1.5px] w-full bg-current transition-transform ${menuOpen ? "translate-y-[4.5px] rotate-45" : ""}`} />
          <span className={`block h-[1.5px] w-full bg-current transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block h-[1.5px] w-full bg-current transition-transform ${menuOpen ? "-translate-y-[4.5px] -rotate-45" : ""}`} />
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className={`${floating ? "absolute top-12 inset-x-0 z-20 bg-[#0b0d12]/95 backdrop-blur-md" : "bg-[var(--bg)]"} sm:hidden border-b border-[var(--border)]`}>
          {links.filter((l) => !l.alwaysVisible).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={`block px-6 py-3 ${linkCls(href)} border-b border-[var(--border)] last:border-b-0`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
