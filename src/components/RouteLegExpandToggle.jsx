import { ChevronDown, ChevronUp } from "lucide-react";

/** RouteSchematic 레일 라인과 동일: w-6 열 중심 = left 10px + 2px */
const RAIL_LINE_LEFT = "left-[10px]";

export function RouteLegExpandToggle({
  count,
  expanded,
  lineColor,
  onToggle,
  hideRail = false,
}) {
  if (count <= 0) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative flex w-full items-center gap-2 py-2 pl-10 text-left text-sm text-slate-500 transition hover:text-slate-700"
    >
      {!hideRail && (
        <div
          className={`absolute ${RAIL_LINE_LEFT} top-0 h-full w-[4px]`}
          style={{ backgroundColor: lineColor }}
        />
      )}
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
