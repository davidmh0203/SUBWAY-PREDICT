import { getStationByName } from "@/lib/metro-network";
import { isSeoulMetroStation } from "@/lib/seoul-metro-stations";

export function RouteMiniMap({ stationIds, segments, seoulOnly = true }) {
  const segmentPaths =
    segments?.length > 0
      ? segments
          .map((seg) => ({
            color: seg.lineColor,
            lineName: seg.lineName,
            points: seg.stations
              .map((st) => {
                const station = getStationByName(st.name);
                if (!station) return null;
                if (seoulOnly && !isSeoulMetroStation(station.name)) return null;
                return station;
              })
              .filter(Boolean),
          }))
          .filter((s) => s.points.length > 0)
      : [];

  const points =
    segmentPaths.length > 0
      ? segmentPaths.flatMap((s) => s.points)
      : stationIds
          .map((id) => {
            const station = getStationByName(String(id).replace(/역$/, ""));
            if (!station) return null;
            if (seoulOnly && !isSeoulMetroStation(station.name)) return null;
            return station;
          })
          .filter(Boolean);

  // dedupe consecutive same station at segment joins (transfer)
  const deduped = points.filter((p, i) => i === 0 || p.id !== points[i - 1].id);

  if (deduped.length < 2) {
    return (
      <div className="flex h-28 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
        서울 지하철 구간만 표시됩니다
      </div>
    );
  }

  const xs = deduped.map((p) => p.x);
  const ys = deduped.map((p) => p.y);
  const pad = 40;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const w = maxX - minX;
  const h = maxY - minY;

  const pathsToDraw =
    segmentPaths.length > 0
      ? segmentPaths
      : [
          {
            color: "#00A84D",
            points: deduped,
          },
        ];

  return (
    <div className="overflow-hidden rounded-xl bg-[#fafbfc] shadow-[inset_0_1px_4px_rgba(15,23,42,0.04)]">
      <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="h-32 w-full">
        {pathsToDraw.map((path, pi) => {
          if (path.points.length < 2) return null;
          return (
            <polyline
              key={`${path.color}-${pi}`}
              points={path.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={path.color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          );
        })}
        {deduped.map((p, i) => {
          const isEnd = i === 0 || i === deduped.length - 1;
          const segColor =
            pathsToDraw.find((path) => path.points.some((pt) => pt.id === p.id))?.color ??
            "#00A84D";
          return (
            <g key={`${p.id}-${i}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isEnd ? 7 : 4}
                fill={isEnd ? segColor : "#fff"}
                stroke={segColor}
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
      {segmentPaths.length > 1 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2">
          {segmentPaths.map((seg) => (
            <span
              key={seg.color + seg.lineName}
              className="inline-flex items-center gap-1 text-[10px] text-slate-500"
            >
              <span className="inline-block h-2 w-3 rounded-full" style={{ backgroundColor: seg.color }} />
              {seg.lineName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
