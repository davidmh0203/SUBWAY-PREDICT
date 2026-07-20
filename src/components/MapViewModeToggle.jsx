import { Map, TrainFront } from "lucide-react";

/**
 * 노선도 ↔ 실제 지도 전환 (`#macro`)
 */
export function MapViewModeToggle({ value, onChange }) {
  return (
    <div
      className="flex rounded-xl bg-slate-100 p-1 shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)]"
      role="tablist"
      aria-label="지도 보기 방식"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "schematic"}
        onClick={() => onChange("schematic")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-all ${
          value === "schematic"
            ? "bg-white text-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
            : "text-slate-500"
        }`}
      >
        <TrainFront className="h-3.5 w-3.5" />
        노선도
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "geo"}
        onClick={() => onChange("geo")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-all ${
          value === "geo"
            ? "bg-white text-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
            : "text-slate-500"
        }`}
      >
        <Map className="h-3.5 w-3.5" />
        실제 지도
      </button>
    </div>
  );
}
