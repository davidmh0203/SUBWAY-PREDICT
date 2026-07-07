import { getStationByName } from "@/lib/metro-network";
import { isSeoulMetroStation } from "@/lib/seoul-metro-stations";

export function RouteMiniMap({ stationIds, segmentLineColors = [], seoulOnly = true }) {
  const points = stationIds
    .map((id) => {
      const station = getStationByName(String(id).replace(/역$/, ""));
      if (!station) return null;
      if (seoulOnly && !isSeoulMetroStation(station.name)) return null;
      return station;
    })
    .filter(Boolean);

  if (points.length < 2) {
    return (
      <div className="flex h-28 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
        서울 지하철 구간만 표시됩니다
      </div>
    );
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const pad = 40;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const w = maxX - minX;
  const h = maxY - minY;

  const lineColor = segmentLineColors[0] ?? "#00A84D";

  return (
    <div className="overflow-hidden rounded-xl bg-[#fafbfc] shadow-[inset_0_1px_4px_rgba(15,23,42,0.04)]">
      <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="h-32 w-full">
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={lineColor}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
        {points.map((p, i) => {
          const isEnd = i === 0 || i === points.length - 1;
          return (
            <g key={p.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isEnd ? 7 : 4}
                fill={isEnd ? lineColor : "#fff"}
                stroke={lineColor}
                strokeWidth={isEnd ? 0 : 2}
              />
              {isEnd && (
                <text
                  x={p.x}
                  y={p.y - 12}
                  textAnchor="middle"
                  fill="#475569"
                  style={{ fontSize: 10, fontFamily: "system-ui, sans-serif" }}
                >
                  {p.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
