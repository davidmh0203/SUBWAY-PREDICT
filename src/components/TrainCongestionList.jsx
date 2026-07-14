import { useMemo } from "react";
import { CongestionLegend, CrowdBlock } from "@/components/CongestionLegend";
import { RouteLegExpandToggle } from "@/components/RouteLegExpandToggle";
import { CROWD_COLORS, CROWD_LABELS, formatDepartureLabel, rateToCrowdLevel } from "@/lib/congestion";
import { buildRidingLegs } from "@/lib/route-station-groups";
import { useRouteCollapse } from "@/hooks/useRouteCollapse";
import { getStationLineColor } from "@/lib/route-segment-colors";

function CongestionRow({ stationName, overallRate, level, lineColor }) {
  const barColor = CROWD_COLORS[level] ?? CROWD_COLORS.NORMAL;
  return (
    <div className="relative flex items-center gap-3">
      <div className="relative flex w-20 shrink-0 items-center">
        <div
          className="absolute left-[9px] top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: lineColor }}
        />
        <span className="ml-5 truncate text-[11px] font-medium text-slate-700">
          {stationName}
        </span>
      </div>
      <div className="flex flex-1 items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, overallRate)}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
        <CrowdBlock
          level={level}
          label={CROWD_LABELS[level]}
          className="h-7 w-14 shrink-0 text-[10px]"
        />
        <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-600">
          {overallRate}%
        </span>
      </div>
    </div>
  );
}

function rowFromName(rowsByName, name, fallbackColor) {
  const key = name?.replace(/역$/, "") ?? "";
  const row =
    rowsByName.get(key) ??
    rowsByName.get(name) ?? {
      stationName: key || name,
      overallRate: 0,
      level: rateToCrowdLevel(0),
    };
  return {
    ...row,
    stationName: row.stationName?.replace(/역$/, "") || key,
    lineColor: fallbackColor,
  };
}

/**
 * 경로 역별 혼잡도 — 다이어그램과 별개로 leg별 펼침/접기
 */
export function TrainCongestionList({ rows, departureTime, segments }) {
  const today = new Date();
  const dateRange = `20${today.getFullYear() - 2000}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}.`;
  const primaryColor = segments?.[0]?.lineColor ?? "#00A84D";

  const { expandedGroups, toggleGroup } = useRouteCollapse(segments);
  const legs = useMemo(() => buildRidingLegs(segments ?? []), [segments]);

  const rowsByName = useMemo(() => {
    const map = new Map();
    for (const row of rows ?? []) {
      const key = String(row.stationName ?? "").replace(/역$/, "");
      if (key) map.set(key, row);
    }
    return map;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">[경로 역별 혼잡도]</h2>
          <p className="text-xs text-slate-500">
            {dateRange} · 모델/API 예측 (칸별 아님)
          </p>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {formatDepartureLabel(departureTime)}
          </p>
        </div>
        <CongestionLegend compact showPercentRanges />
      </div>

      <div className="relative space-y-1 pl-1">
        <div
          className="absolute left-[11px] top-2 bottom-2 w-[3px] rounded-full opacity-20"
          style={{
            background: segments?.length
              ? `linear-gradient(to bottom, ${segments.map((s) => s.lineColor).join(", ")})`
              : primaryColor,
          }}
        />

        {legs.length === 0
          ? (rows ?? []).map((row, idx) => (
              <CongestionRow
                key={`${row.stationName}-${idx}`}
                stationName={row.stationName}
                overallRate={row.overallRate}
                level={row.level}
                lineColor={getStationLineColor(row.stationName, segments) ?? primaryColor}
              />
            ))
          : legs.map((leg) => {
              const expanded = expandedGroups.has(leg.id);
              const boarding = rowFromName(rowsByName, leg.boarding.name, leg.lineColor);
              const alighting = rowFromName(rowsByName, leg.alighting.name, leg.lineColor);
              const waypointRows = leg.waypoints.map((wp) =>
                rowFromName(rowsByName, wp.name, leg.lineColor),
              );

              return (
                <div key={leg.id} className="space-y-1">
                  <CongestionRow
                    stationName={boarding.stationName}
                    overallRate={boarding.overallRate}
                    level={boarding.level}
                    lineColor={leg.lineColor}
                  />
                  {waypointRows.length > 0 && (
                    <>
                      <RouteLegExpandToggle
                        count={waypointRows.length}
                        expanded={expanded}
                        lineColor={leg.lineColor}
                        hideRail
                        onToggle={() => toggleGroup(leg.id)}
                      />
                      {expanded &&
                        waypointRows.map((row) => (
                          <CongestionRow
                            key={`${leg.id}-${row.stationName}`}
                            stationName={row.stationName}
                            overallRate={row.overallRate}
                            level={row.level}
                            lineColor={leg.lineColor}
                          />
                        ))}
                    </>
                  )}
                  <CongestionRow
                    stationName={alighting.stationName}
                    overallRate={alighting.overallRate}
                    level={alighting.level}
                    lineColor={leg.lineColor}
                  />
                </div>
              );
            })}
      </div>

      {segments?.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {segments.map((seg) => (
            <span
              key={seg.lineColor + seg.lineName}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: seg.lineColor }}
              />
              {seg.lineName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
