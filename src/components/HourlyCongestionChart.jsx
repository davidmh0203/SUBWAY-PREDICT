import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { CROWD_COLORS } from "@/lib/congestion";
import { CongestionLegend } from "@/components/CongestionLegend";

export function HourlyCongestionChart({
  data,
  activeHour,
  stationName = "사당",
  lineName = "2호선",
  direction = "강남 방면",
  dataSource,
  onDirectionSwap,
}) {
  const today = new Date();
  const dateRange = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}.`;
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const sourceHint =
    dataSource === "model"
      ? "모델 예측"
      : dataSource === "mock"
        ? "목업"
        : dataSource
          ? dataSource
          : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold leading-snug text-slate-900">
            [{lineName} {stationName}역] 시간대별 혼잡도
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {dateRange}
            {sourceHint ? ` · ${sourceHint}` : ""}
            {", "}
            {direction}, {dayNames[today.getDay()]}요일
          </p>
        </div>
        {onDirectionSwap && (
          <button
            type="button"
            onClick={onDirectionSwap}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs text-slate-600 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition hover:shadow-[0_2px_8px_rgba(15,23,42,0.1)]"
          >
            ⇄ 열차방향 바꾸기
          </button>
        )}
      </div>
      <div className="relative">
        <p
          className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] tracking-tight text-slate-400"
          style={{ transformOrigin: "center", marginLeft: "-8px" }}
        >
          지하철 혼잡도
        </p>
        <div className="ml-4 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              barCategoryGap={2}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="hour"
                tickFormatter={(h) => `${h}시`}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[0, 160]} />
              <Bar dataKey="rate" radius={[2, 2, 0, 0]} maxBarSize={14}>
                {data.map((entry) => (
                  <Cell
                    key={entry.hour}
                    fill={CROWD_COLORS[entry.level]}
                    opacity={
                      activeHour !== undefined && entry.hour === activeHour
                        ? 1
                        : 0.92
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <CongestionLegend />
    </div>
  );
}
