"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { switchLocaleInUrl } from "@/lib/locale-url";

const LOCALES = [
  { code: "cs", label: "CS" },
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const switchLocale = (code: string) => {
    router.push(switchLocaleInUrl(pathname, searchParams.toString(), code));
  };

  return (
    <div className="flex gap-3 items-center">
      {LOCALES.map((l, i) => (
        <span key={l.code} className="flex items-center gap-3">
          {i > 0 && <span className="text-[var(--text-faint)] text-xs">·</span>}
          <button
            onClick={() => switchLocale(l.code)}
            aria-label={t("languageTo", { language: l.label })}
            aria-current={locale === l.code ? "true" : undefined}
            className={`text-xs tracking-widest font-medium transition-colors ${
              locale === l.code
                ? "text-[var(--accent)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {l.label}
          </button>
        </span>
      ))}
    </div>
  );
}
