"use client";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { CityConfig } from "@/lib/cities";

interface Props {
  cities: CityConfig[];
  value: CityConfig;
  onChange: (city: CityConfig) => void;
  placeholder?: string;
}

export default function CitySearch({ cities, value, onChange, placeholder }: Props) {
  const t = useTranslations("citySearch");
  const searchLabel = placeholder ?? t("placeholder");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedIndex, setSelectedIndex] = useState(-1);

  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  
  const filtered = query.trim()
    ? cities.filter((c) => norm(c.name).includes(norm(query)))
    : cities;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setSelectedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [query, open]);

  const select = (city: CityConfig) => {
    onChange(city);
    setOpen(false);
    setQuery("");
    setSelectedIndex(-1);
  };

  const handleFocus = () => {
    setOpen(true);
    setQuery("");
    setSelectedIndex(-1);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filtered.length) select(filtered[selectedIndex]);
      else if (filtered.length > 0) select(filtered[0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      setSelectedIndex(-1);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] px-3 py-2 focus-within:border-[var(--accent)] transition-colors">
        {/* search icon */}
        <svg className="w-3 h-3 flex-shrink-0 text-[var(--text-faint)]" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value.name}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKey}
          placeholder={searchLabel}
          aria-label={searchLabel}
          className="flex-1 bg-transparent text-xs font-body text-[var(--text)] placeholder-[var(--text-faint)] outline-none min-w-0"
        />
        {/* chevron */}
        <svg
          className={`w-3 h-3 flex-shrink-0 text-[var(--text-faint)] transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 16 16" fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-[var(--surface)] border border-t-0 border-[var(--border)] max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs font-body text-[var(--text-faint)]">
              {t("noResults")}
            </div>
          ) : (
            filtered.map((city, i) => (
              <button
                key={city.id}
                role="option"
                aria-selected={i === selectedIndex}
                onMouseDown={(e) => { e.preventDefault(); select(city); }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-body transition-colors border-b border-[var(--border)] last:border-b-0 ${
                  i === selectedIndex || city.id === value.id
                    ? "text-[var(--accent)] bg-[var(--accent-glow)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--card)]"
                }`}
              >
                {city.id === value.id && (
                  <span className="w-1 h-1 rounded-full bg-[var(--accent)] flex-shrink-0" />
                )}
                {city.id !== value.id && <span className="w-1 h-1 flex-shrink-0" />}
                {city.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
