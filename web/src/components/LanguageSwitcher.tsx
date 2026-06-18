"use client";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";

const LOCALES = [
  { code: "cs", label: "CS" },
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (code: string) => {
    const segments = pathname.split("/");
    segments[1] = code;
    router.push(segments.join("/"));
  };

  return (
    <div className="flex gap-3 items-center">
      {LOCALES.map((l, i) => (
        <span key={l.code} className="flex items-center gap-3">
          {i > 0 && <span className="text-[var(--text-faint)] text-xs">·</span>}
          <button
            onClick={() => switchLocale(l.code)}
            aria-label={`Změnit jazyk na ${l.code}`}
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
