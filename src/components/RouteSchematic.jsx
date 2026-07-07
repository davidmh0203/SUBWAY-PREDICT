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

function TransferConnector({ prevColor, seg }) {
  return (
    <div className="relative my-2 flex items-center gap-2 pl-[11px]">
      <div
        className="absolute left-[11px] top-0 h-full w-[4px] opacity-40"
        style={{
          background: `repeating-linear-gradient(to bottom, ${prevColor} 0, ${prevColor} 4px, transparent 4px, transparent 8px)`,
        }}
      />
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
  );
}

function CollapseChip({ group, expanded, onToggle, lineColor }) {
  return (
    <button
      type="button"
      onClick={() => onToggle?.(group.id)}
      className="relative my-1 flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-left text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
    >
      <div
        className="absolute left-[10px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
        style={{ backgroundColor: lineColor }}
      />
      {expanded ? (
        <ChevronUp className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>
        {group.beforeKey}역 ~ {group.afterKey}역 사이{" "}
        <strong className="text-slate-800">{group.waypointNames.length}개 역</strong>{" "}
        <span className="text-slate-400">· 탭하여 {expanded ? "접기" : "펼치기"}</span>
      </span>
    </button>
  );
}

function StationRow({ st, seg, showLineBelow }) {
  const isSpecial = st.type === "departure" || st.type === "arrival" || st.type === "transfer";
  const label = TYPE_LABEL[st.type];
  const congStyle = st.congestionStatus ? CONGESTION_STYLES[st.congestionStatus] : null;
  const color = seg.lineColor;

  return (
    <div className="relative" style={{ minHeight: isSpecial ? 72 : 52 }}>
      {showLineBelow && (
        <div
          className="absolute top-6 w-[4px] rounded-b-sm"
          style={{
            left: isSpecial ? 10 : 14,
            height: "calc(100% - 4px)",
            backgroundColor: color,
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
            backgroundColor: st.type === "waypoint" ? "#ffffff" : color,
            borderColor: st.type === "waypoint" ? color : "#ffffff",
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
                style={{ backgroundColor: color }}
              >
                {label}
              </span>
            )}

            {st.showBoarding && (
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  color,
                  borderColor: color + "66",
                  backgroundColor: lineLight(color),
                }}
              >
                {seg.lineName} 탑승
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
                혼잡도 <strong className="text-slate-700">{st.congestionRate}%</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SegmentBlock({ seg, segIndex, groups, expandedGroups, onToggleGroup, isLastSeg }) {
  const namesInSeg = new Set(seg.stations.map((s) => s.name));
  const segGroups = groups.filter((g) => g.waypointNames.every((n) => namesInSeg.has(n)));
  const flat = seg.stations.map((st) => ({
    ...st,
    lineColor: seg.lineColor,
    lineName: seg.lineName,
  }));
  const items = buildRenderItems(flat, segGroups, expandedGroups);

  return (
    <div className="relative pl-1">
      {items.map((item, idx) => {
        const isLastItemInSeg = idx === items.length - 1;
        const showLineBelow = !isLastItemInSeg || !isLastSeg;

        if (item.type === "collapse") {
          return (
            <CollapseChip
              key={item.group.id}
              group={item.group}
              expanded={expandedGroups?.has(item.group.id)}
              onToggle={onToggleGroup}
              lineColor={seg.lineColor}
            />
          );
        }

        const isFirstInSeg = seg.stations[0]?.name === item.station.name;
        const station = {
          ...item.station,
          showBoarding: isFirstInSeg && item.station.type !== "transfer",
        };

        return (
          <StationRow
            key={`${segIndex}-${item.station.name}-${idx}`}
            st={station}
            seg={seg}
            showLineBelow={showLineBelow}
          />
        );
      })}
    </div>
  );
}

export function RouteSchematic({ segments, expandedGroups, onToggleGroup }) {
  if (!segments?.length) return null;

  const { groups } = buildRouteStationGroups(segments);

  return (
    <div className="relative">
      {segments.map((seg, si) => (
        <div key={`${seg.lineColor}-${si}`}>
          {si > 0 && <TransferConnector prevColor={segments[si - 1].lineColor} seg={seg} />}
          <SegmentBlock
            seg={seg}
            segIndex={si}
            groups={groups}
            expandedGroups={expandedGroups}
            onToggleGroup={onToggleGroup}
            isLastSeg={si === segments.length - 1}
          />
        </div>
      ))}
    </div>
  );
}
