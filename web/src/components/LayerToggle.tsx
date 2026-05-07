import type { LayerConfig } from "@/types";

interface Props {
  layer: LayerConfig;
  active: boolean;
  label: string;
  onClick: () => void;
}

export default function LayerToggle({ layer, active, label, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-emerald-100 text-emerald-900 font-medium"
          : "hover:bg-gray-100 text-gray-700"
      }`}
    >
      <span className="text-base">{layer.icon}</span>
      <span>{label}</span>
    </button>
  );
}
