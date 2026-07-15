import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { CROWD_COLORS, rateToCrowdLevel } from "@/lib/congestion";
import { CongestionLegend } from "@/components/CongestionLegend";
import { flattenRouteStations } from "@/components/RouteCongestionStrip";

/**
 * 경로 상세용 — 지나는 역별 혼잡도 막대 (시간대별 차트와 동일 톤)
 */
export function StationCongestionChart({ route, departureTime }) {
  const stations = flattenRouteStations(route?.segments);
  const data = stations.map((st) => {
    const rate = Number(st.congestionRate) || 0;
    return {
      name: st.name,
      rate,
      level: rateToCrowdLevel(rate),
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
      <CongestionLegend compact />
    </div>
  );
}
