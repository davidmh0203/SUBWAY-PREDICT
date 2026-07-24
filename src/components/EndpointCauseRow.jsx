import { CrowdBlock } from "@/components/CongestionLegend";
import { CauseChip, normalizeCause } from "@/lib/congestion-cause";
import { CROWD_LABELS, rateToCrowdLevel } from "@/lib/congestion";
import { flattenRouteStations } from "@/components/RouteCongestionStrip";
import { formatStationLabel } from "@/lib/station-name";

function causeByStationName(route) {
  const map = new Map();
  for (const p of route?.stationPredictions ?? []) {
    const key = String(p.stationName ?? "").replace(/역$/u, "");
    if (key && p.cause) map.set(key, p.cause);
  }
  for (const seg of route?.segments ?? []) {
    for (const s of seg.stations ?? []) {
      const key = String(s.name ?? "").replace(/역$/u, "");
      if (key && s.cause && !map.has(key)) map.set(key, s.cause);
    }
  }
  return map;
}

/**
 * 경로 출발·도착만 혼잡 + 예측 원인 칩
 * @param {{ route: object, compact?: boolean, className?: string }} props
 */
export function EndpointCauseRow({ route, compact = false, className = "" }) {
  const stations = flattenRouteStations(route?.segments);
  if (!stations.length) return null;
  const causes = causeByStationName(route);
  const endpoints = [
    { role: "출발", ...stations[0] },
    ...(stations.length > 1
      ? [{ role: "도착", ...stations[stations.length - 1] }]
      : []),
  ].map((ep) => {
    const key = String(ep.name ?? "").replace(/역$/u, "");
    const cause = normalizeCause(ep.cause ?? causes.get(key));
    const rate = Number(ep.congestionRate) || 0;
    return {
      ...ep,
      cause,
      level: rateToCrowdLevel(rate),
      rate,
    };
  });

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {endpoints.map((ep) => (
        <div
          key={`${ep.role}-${ep.name}`}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50/80 ${
            compact ? "px-1.5 py-1" : "px-2 py-1.5"
          }`}
        >
          <span className="text-[10px] font-medium text-slate-400">{ep.role}</span>
          <span
            className={`font-semibold text-slate-700 ${
              compact ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {formatStationLabel(ep.name)}
          </span>
          {!compact && (
            <CrowdBlock
              level={ep.level}
              label={CROWD_LABELS[ep.level]}
              className="h-6 w-12 shrink-0 text-[9px]"
            />
          )}
          {ep.cause ? <CauseChip cause={ep.cause} size={compact ? "sm" : "md"} /> : null}
        </div>
      ))}
    </div>
  );
}
