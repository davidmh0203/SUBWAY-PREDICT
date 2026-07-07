import { ChevronDown, ChevronUp } from "lucide-react";

export function RouteLegExpandToggle({ count, expanded, lineColor, onToggle }) {
  if (count <= 0) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative flex w-full items-center gap-2 py-2 pl-10 text-left text-sm text-slate-500 transition hover:text-slate-700"
    >
      <div
        className="absolute left-[11px] top-0 h-full w-[4px]"
        style={{ backgroundColor: lineColor }}
      />
      <span>
        <strong className="font-semibold text-slate-700">{count}개</strong> 역 이동
      </span>
      {expanded ? (
        <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
      ) : (
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      )}
    </button>
  );
}
