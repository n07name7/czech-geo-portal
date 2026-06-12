import type { LayerConfig } from "@/types";

interface Props {
  layer: LayerConfig;
  active: boolean;
  label: string;
  onClick: () => void;
}

export default function LayerToggle({ active, label, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 w-full px-4 py-3 text-left transition-all duration-200 border-l-2 ${
        active
          ? "bg-[var(--accent-glow)] text-[var(--accent)] font-semibold border-[var(--accent)]"
          : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--card)] border-transparent"
      }`}
    >
      <span className="font-body text-xs leading-none tracking-wide">{label}</span>
      {active && (
        <span className="ml-auto w-1 h-1 rounded-full bg-[var(--accent)]" />
      )}
    </button>
  );
}
