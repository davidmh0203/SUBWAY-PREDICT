import { CongestionLegend, CrowdBlock } from "@/components/CongestionLegend";
import { formatDepartureLabel } from "@/lib/congestion";
import type { CarCongestionRow } from "@/lib/types";

interface CarCongestionHeatmapProps {
  rows: CarCongestionRow[];
  departureTime: Date;
  lineColor?: string;
}

export function CarCongestionHeatmap({
  rows,
  departureTime,
  lineColor = "#8a9a5b",
}: CarCongestionHeatmapProps) {
  const today = new Date();
  const dateRange = `20${today.getFullYear() - 2000}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}.`;

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
        <CongestionLegend compact />
      </div>

      <div className="flex gap-0">
        {/* 노선 트랙 */}
        <div className="relative w-24 shrink-0 pt-1">
          <div
            className="absolute left-[18px] top-3 bottom-3 w-[3px] rounded-full"
            style={{ backgroundColor: lineColor }}
          />
          {rows.map((row, i) => (
            <div
              key={row.stationName}
              className="relative flex h-9 items-center"
              style={{ marginBottom: i < rows.length - 1 ? 2 : 0 }}
            >
              <div
                className="absolute left-[14px] z-10 h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: lineColor }}
              />
              <span className="ml-7 truncate text-[11px] font-medium text-slate-700">
                {row.stationName}
              </span>
            </div>
          ))}
        </div>

        {/* 칸별 히트맵 */}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="mb-1 flex gap-[3px] pl-0.5">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="w-7 shrink-0 text-center text-[9px] text-slate-400">
                {i + 1}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.stationName} className="mb-[2px] flex gap-[3px]">
              {row.cars.map((level, carIdx) => (
                <CrowdBlock
                  key={carIdx}
                  level={level}
                  label={carIdx + 1}
                  className="h-9 w-7 shrink-0"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-slate-400">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: lineColor }} />
        2호선 외선순환 · 칸 번호 1(선두) ~ 8(후미)
      </div>
    </div>
  );
}
