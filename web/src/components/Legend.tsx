export default function Legend({ labelLow, labelHigh }: { labelLow: string; labelHigh: string }) {
  return (
    <div className="absolute bottom-6 left-4 z-10 bg-[var(--surface)] border border-[var(--border)] px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="font-body text-[10px] tracking-wider uppercase text-[var(--text-faint)]">{labelLow}</span>
        <div
          className="w-20 h-2"
          style={{
            background: "linear-gradient(to right, #162d22, #1d5c38, #79b025, #e8a030)",
          }}
        />
        <span className="font-body text-[10px] tracking-wider uppercase text-[var(--text-faint)]">{labelHigh}</span>
      </div>
    </div>
  );
}
