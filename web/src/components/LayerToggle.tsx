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
      className={`flex items-center gap-3 w-full px-3 py-2 text-left transition-colors ${
        active
          ? "bg-[var(--accent-glow)] text-[var(--accent)] font-medium border-l-2 border-[var(--accent)]"
          : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--card)] border-l-2 border-transparent"
      }`}
    >
      <span className="font-body text-xs leading-snug">{label}</span>
    </button>
  );
}
