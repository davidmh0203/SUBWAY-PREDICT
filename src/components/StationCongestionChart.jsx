import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { CROWD_COLORS, CROWD_LABELS, rateToCrowdLevel } from "@/lib/congestion";
import { normalizeCause } from "@/lib/congestion-cause";
import { CongestionLegend } from "@/components/CongestionLegend";
import { flattenRouteStations } from "@/components/RouteCongestionStrip";
import { formatStationLabel } from "@/lib/station-name";

function mergeCauseFromPredictions(stations, route) {
  const byName = new Map();
  for (const p of route?.stationPredictions ?? []) {
    const key = String(p.stationName ?? "").replace(/역$/u, "");
    if (key && p.cause) byName.set(key, p.cause);
  }
  return stations.map((st) => {
    const key = String(st.name ?? "").replace(/역$/u, "");
    return {
      ...st,
      cause: normalizeCause(st.cause ?? byName.get(key)),
    };
  });
}

/**
 * 경로 상세용 — 지나는 역별 혼잡도 막대 (시간대별 차트와 동일 톤)
 * 출발·도착 역에 한해 `31% 혼잡 (저녁피크)` 형식으로 예측 원인 표시
 */
export function StationCongestionChart({ route, departureTime }) {
  const stations = mergeCauseFromPredictions(
    flattenRouteStations(route?.segments),
    route,
  );
  const data = stations.map((st) => {
    const rate = Number(st.congestionRate) || 0;
    return {
      name: st.name,
      rate,
      level: rateToCrowdLevel(rate),
      cause: normalizeCause(st.cause),
    };
  });

  if (data.length === 0) return null;

  const today = departureTime instanceof Date ? departureTime : new Date();
  const dateRange = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}.`;
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const timeLabel = today.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const many = data.length > 10;
  const chartMinWidth = many ? Math.max(320, data.length * 28) : "100%";
  const endpoints = [
    { role: "출발", ...data[0] },
    ...(data.length > 1 ? [{ role: "도착", ...data[data.length - 1] }] : []),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold leading-snug text-slate-900">
          경로 역별 혼잡도
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {dateRange} · {timeLabel} 출발 · {dayNames[today.getDay()]}요일
        </p>
      </div>
      <div className="relative">
        <p
          className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] tracking-tight text-slate-400"
          style={{ transformOrigin: "center", marginLeft: "-8px" }}
        >
          지하철 혼잡도
        </p>
        <div className={`ml-4 h-44 ${many ? "overflow-x-auto" : ""}`}>
          <div style={{ width: chartMinWidth, height: "100%", minWidth: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                barCategoryGap={many ? 1 : 2}
                margin={{ top: 4, right: 4, left: 0, bottom: many ? 28 : 8 }}
              >
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={many ? -40 : 0}
                  textAnchor={many ? "end" : "middle"}
                  height={many ? 48 : 28}
                  tick={{ fill: "#94a3b8", fontSize: many ? 9 : 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={[0, 160]} />
                <Bar dataKey="rate" radius={[2, 2, 0, 0]} maxBarSize={many ? 12 : 18}>
                  {data.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={CROWD_COLORS[entry.level]}
                      opacity={0.95}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {endpoints.map((ep) => {
          const color = CROWD_COLORS[ep.level];
          const label = CROWD_LABELS[ep.level];
          return (
            <div
              key={`${ep.role}-${ep.name}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-slate-100 bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <span className="text-[10px] font-medium text-slate-400">{ep.role}</span>
              <span className="text-[11px] font-semibold text-slate-700">
                {formatStationLabel(ep.name)}
              </span>
              <span className="inline-flex items-baseline gap-0.5 text-[11px] font-semibold tabular-nums">
                <span className="text-slate-800">{ep.rate}%</span>
                <span style={{ color }}>{label}</span>
                {ep.cause ? (
                  <span className="font-medium text-slate-400">({ep.cause})</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      <CongestionLegend compact />
    </div>
  );
}
