"use client";
import { useState, useRef, useEffect } from "react";
import type { CityConfig } from "@/lib/cities";

interface Props {
  cities: CityConfig[];
  value: CityConfig;
  onChange: (city: CityConfig) => void;
  placeholder?: string;
}

export default function CitySearch({ cities, value, onChange, placeholder = "Hledat město…" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? cities.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : cities;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (city: CityConfig) => {
    onChange(city);
    setOpen(false);
    setQuery("");
  };

  const handleFocus = () => {
    setOpen(true);
    setQuery("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); setQuery(""); inputRef.current?.blur(); }
    if (e.key === "Enter" && filtered.length > 0) select(filtered[0]);
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
          placeholder={placeholder}
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
              Nic nenalezeno
            </div>
          ) : (
            filtered.map((city) => (
              <button
                key={city.id}
                onMouseDown={(e) => { e.preventDefault(); select(city); }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-body transition-colors border-b border-[var(--border)] last:border-b-0 ${
                  city.id === value.id
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
