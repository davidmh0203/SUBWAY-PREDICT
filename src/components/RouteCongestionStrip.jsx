import { CROWD_COLORS, rateToCrowdLevel } from "@/lib/congestion";

/**
 * segments → 연속 중복 제거된 역 목록 (환승 경계 첫 역은 유지)
 * @param {Array<{ stations?: Array<{ name: string, congestionRate?: number }> }>} segments
 */
export function flattenRouteStations(segments) {
  const out = [];
  for (const seg of segments ?? []) {
    for (const st of seg.stations ?? []) {
      const name = st.name;
      if (!name) continue;
      const last = out[out.length - 1];
      if (last && last.name === name) {
        last.congestionRate = st.congestionRate ?? last.congestionRate;
        continue;
      }
      out.push({
        name,
        congestionRate: st.congestionRate ?? 0,
      });
    }
  }
  return out;
}

function shouldLabel(stations, index) {
  if (stations.length <= 5) return true;
  if (index === 0 || index === stations.length - 1) return true;
  const step = Math.ceil(stations.length / 4);
  return index % step === 0;
}

/**
 * @param {'plain' | 'dividers' | 'nodes'} variant
 *   plain — 색 구간만 (현재 프로덕션)
 *   dividers — 역 사이 흰 세로 구분선
 *   nodes — 경계에 흰 점(노드)
 */
export function RouteCongestionStrip({
  route,
  className = "",
  variant = "plain",
  showTitle = true,
}) {
  const stations = flattenRouteStations(route?.segments);
  if (stations.length === 0) return null;

  const withNodes = variant === "nodes";
  const withDividers = variant === "dividers" || withNodes;

  return (
    <div className={className}>
      {showTitle && (
        <p className="mb-1.5 text-[10px] font-medium text-slate-500">역별 혼잡</p>
      )}
      <div
        className={`relative flex h-3 overflow-hidden rounded-full ring-1 ring-slate-100 ${
          withNodes ? "overflow-visible" : ""
        }`}
      >
        {stations.map((st, i) => {
          const level = rateToCrowdLevel(st.congestionRate);
          const showDivider = withDividers && i > 0;
          return (
            <div
              key={`${st.name}-${i}`}
              className="relative min-w-0 flex-1"
              style={{ backgroundColor: CROWD_COLORS[level] }}
              title={`${st.name} · ${st.congestionRate}%`}
            >
              {showDivider && (
                <span
                  className="absolute left-0 top-0 z-[1] h-full w-px bg-white/90"
                  aria-hidden
                />
              )}
              {withNodes && i > 0 && (
                <span
                  className="absolute left-0 top-1/2 z-[2] h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm"
                  style={{ border: "2.2px solid #1a1a1a" }}
                  aria-hidden
                />
              )}
              {withNodes && i === 0 && (
                <span
                  className="absolute left-0 top-1/2 z-[2] h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm"
                  style={{ border: "2.2px solid #1a1a1a" }}
                  aria-hidden
                />
              )}
              {withNodes && i === stations.length - 1 && (
                <span
                  className="absolute right-0 top-1/2 z-[2] h-[9px] w-[9px] translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm"
                  style={{ border: "2.2px solid #1a1a1a" }}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
      <div className={`mt-1 flex ${withNodes ? "px-0.5" : ""}`}>
        {stations.map((st, i) => (
          <div
            key={`lbl-${st.name}-${i}`}
            className="min-w-0 flex-1 overflow-hidden px-0.5"
          >
            {shouldLabel(stations, i) ? (
              <p className="truncate text-center text-[9px] leading-tight text-slate-500">
                {st.name.replace(/역$/u, "")}
              </p>
            ) : (
              <p className="text-center text-[9px] leading-tight text-transparent">
                ·
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
