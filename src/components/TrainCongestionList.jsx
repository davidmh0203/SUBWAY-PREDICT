import { CongestionLegend, CrowdBlock } from "@/components/CongestionLegend";
import { CROWD_LABELS, formatDepartureLabel } from "@/lib/congestion";
import { buildRidingLegs, isWaypointVisible } from "@/lib/route-station-groups";
import { getStationLineColor } from "@/lib/route-segment-colors";

export function TrainCongestionList({ rows, departureTime, segments, expandedGroups }) {
  const today = new Date();
  const dateRange = `20${today.getFullYear() - 2000}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}.`;
  const legs = segments?.length ? buildRidingLegs(segments) : [];
  const visibleRows = rows.filter((row) =>
    isWaypointVisible(row.stationName, legs, expandedGroups),
  );
  const primaryColor = segments?.[0]?.lineColor ?? "#00A84D";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">[시간대별 경로 혼잡도]</h2>
          <p className="text-xs text-slate-500">
            {dateRange} ~ {dateRange}
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

        {visibleRows.map((row, idx) => {
          const lineColor = getStationLineColor(row.stationName, segments);

          return (
            <div key={`${row.stationName}-${idx}`} className="relative flex items-center gap-3">
              <div className="relative flex w-20 shrink-0 items-center">
                <div
                  className="absolute left-[9px] top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: lineColor }}
                />
                <span className="ml-5 truncate text-[11px] font-medium text-slate-700">
                  {row.stationName}
                </span>
              </div>
              <div className="flex flex-1 items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, row.overallRate)}%`,
                      backgroundColor:
                        row.level === "RELAXED"
                          ? "#3cb878"
                          : row.level === "NORMAL"
                            ? "#5b9bd5"
                            : row.level === "BUSY"
                              ? "#8b6cc1"
                              : "#e06090",
                    }}
                  />
                </div>
                <CrowdBlock
                  level={row.level}
                  label={CROWD_LABELS[row.level]}
                  className="h-7 w-14 shrink-0 text-[10px]"
                />
                <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-600">
                  {row.overallRate}%
                </span>
              </div>
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

      <div className="flex items-center gap-2 text-[10px] text-slate-400">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: primaryColor }}
        />
        역별 열차 혼잡도 · 경로 다이어그램 토글과 동기화
      </div>
    </div>
  );
}
