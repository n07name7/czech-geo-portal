export default function Legend({
  labelLow,
  labelHigh,
  gradientCss,
}: {
  labelLow: string;
  labelHigh: string;
  gradientCss: string;
}) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-10 bg-[var(--surface)] border border-[var(--border)] px-4 py-2.5 whitespace-nowrap"
      style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex items-center gap-3">
        <span className="font-body text-[10px] tracking-wider uppercase text-[var(--text-faint)]">{labelLow}</span>
        <div className="w-20 h-2" style={{ background: gradientCss }} />
        <span className="font-body text-[10px] tracking-wider uppercase text-[var(--text-faint)]">{labelHigh}</span>
      </div>
    </div>
  );
}
