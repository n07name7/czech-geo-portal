export default function Legend({ labelLow, labelHigh }: { labelLow: string; labelHigh: string }) {
  return (
    <div className="absolute bottom-8 right-4 bg-white/90 rounded-lg px-3 py-2 shadow text-xs z-10">
      <div className="flex items-center gap-2">
        <span>{labelLow}</span>
        <div
          className="w-24 h-3 rounded"
          style={{
            background: "linear-gradient(to right, rgba(0,0,0,0), #ffffb2, #fd8d3c, #e31a1c, #800026)",
          }}
        />
        <span>{labelHigh}</span>
      </div>
    </div>
  );
}
