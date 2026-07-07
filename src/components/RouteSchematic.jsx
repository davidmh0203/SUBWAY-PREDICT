import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONGESTION_STYLES } from "@/lib/congestion";
import { buildRenderItems, buildRouteStationGroups } from "@/lib/route-station-groups";

const TYPE_LABEL = {
  departure: "출발",
  arrival: "도착",
  transfer: "환승",
  waypoint: null,
};

function lineLight(hex) {
  return hex + "22";
}

function CollapseChip({ group, expanded, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(group.id)}
      className="relative my-1 flex w-full items-center gap-2 rounded-lg bg-slate-50 py-2 pl-10 pr-3 text-left text-xs text-slate-600 transition hover:bg-slate-100"
    >
      {expanded ? (
        <ChevronUp className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>
        {group.beforeKey}역 ~ {group.afterKey}역 사이{" "}
        <strong>{group.waypointNames.length}개 역</strong>
      </span>
    </button>
  );
}

function StationRow({ st, isLast, seg }) {
  const isSpecial = st.type === "departure" || st.type === "arrival" || st.type === "transfer";
  const label = TYPE_LABEL[st.type];
  const congStyle = st.congestionStatus ? CONGESTION_STYLES[st.congestionStatus] : null;

  return (
    <div className="relative" style={{ minHeight: isSpecial ? 72 : 52 }}>
      {!isLast && (
        <div
          className="absolute top-6 w-[4px] rounded-b-sm"
          style={{
            left: isSpecial ? 10 : 14,
            height: "calc(100% - 4px)",
            backgroundColor: st.lineColor ?? seg.lineColor,
          }}
        />
      )}

      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            "relative z-10 mt-1 flex-shrink-0 rounded-full border-[3px] border-white shadow-md",
            isSpecial ? "mt-[2px]" : "mt-[6px]",
          )}
          style={{
            width: isSpecial ? 24 : 16,
            height: isSpecial ? 24 : 16,
            marginLeft: isSpecial ? 0 : 4,
            backgroundColor: st.type === "waypoint" ? "#ffffff" : (st.lineColor ?? seg.lineColor),
            borderColor: st.type === "waypoint" ? (st.lineColor ?? seg.lineColor) : "#ffffff",
            borderWidth: isSpecial ? 3 : 2,
          }}
        />

        <div className="flex-1 pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "text-slate-800",
                isSpecial ? "text-sm font-bold" : "text-sm font-medium",
              )}
            >
              {st.name}역
            </span>

            {label && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: st.lineColor ?? seg.lineColor }}
              >
                {label}
              </span>
            )}

            {st.showBoarding && (
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  color: st.lineColor ?? seg.lineColor,
                  borderColor: (st.lineColor ?? seg.lineColor) + "66",
                  backgroundColor: lineLight(st.lineColor ?? seg.lineColor),
                }}
              >
                {st.lineName ?? seg.lineName} 탑승
              </span>
            )}

            {st.arrivalTime && isSpecial && (
              <span className="ml-auto font-mono text-xs tabular-nums text-slate-400">
                {st.arrivalTime}
              </span>
            )}
          </div>

          {st.congestionRate !== undefined && isSpecial && congStyle && (
            <div className="mt-1 flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${congStyle.dot}`} />
              <span className="text-xs text-slate-500">
                혼잡도 <strong className="text-slate-700">{st.congestionRate}%</strong> —{" "}
                {congStyle.emoji}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RouteSchematic({ segments, expandedGroups, onToggleGroup }) {
  const { flat, groups } = buildRouteStationGroups(segments);
  const renderItems = buildRenderItems(flat, groups, expandedGroups);

  let prevSegIdx = -1;

  return (
    <div className="relative">
      {renderItems.map((item, idx) => {
        if (item.type === "collapse") {
          return (
            <CollapseChip
              key={item.group.id}
              group={item.group}
              expanded={expandedGroups?.has(item.group.id)}
              onToggle={onToggleGroup}
            />
          );
        }

        const st = item.station;
        const segIdx = segments.findIndex((seg) =>
          seg.stations.some((s) => s.name === st.name && (s.type === st.type || !st.type)),
        );
        const seg = segments[segIdx] ?? segments[0];
        const showTransfer =
          segIdx > 0 && segIdx !== prevSegIdx && prevSegIdx >= 0 && item.station.type !== "departure";
        prevSegIdx = segIdx;

        const isLast = idx === renderItems.length - 1;
        const isFirstInSeg = seg.stations[0]?.name === st.name;
        const station = { ...st, showBoarding: isFirstInSeg && st.type !== "transfer" };

        return (
          <div key={`${st.name}-${idx}`}>
            {showTransfer && (
              <div className="relative my-1 flex items-center gap-2 pl-[11px]">
                <div
                  className="ml-8 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{
                    backgroundColor: lineLight(seg.lineColor),
                    color: seg.lineColor,
                    border: `1px solid ${seg.lineColor}44`,
                  }}
                >
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.lineColor }} />
                  {seg.lineName} 환승
                </div>
              </div>
            )}
            <StationRow st={station} isLast={isLast} seg={seg} />
          </div>
        );
      })}
    </div>
  );
}
