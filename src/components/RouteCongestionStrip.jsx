import { useEffect, useRef, useState } from "react";
import {
  CROWD_COLORS,
  CROWD_LABELS,
  rateToCrowdLevel,
} from "@/lib/congestion";
import { formatStationLabel } from "@/lib/station-name";

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

/** 상시 라벨: 출발·도착만 (중간은 탭/호버) */
function shouldLabel(stations, index) {
  return index === 0 || index === stations.length - 1;
}

/**
 * @param {'plain' | 'dividers' | 'nodes'} variant
 *   plain — 색 구간만
 *   dividers — 역 사이 흰 세로 구분선 (프로덕션 기본)
 *   nodes — 경계에 흰 점(노드)
 */
export function RouteCongestionStrip({
  route,
  className = "",
  variant = "dividers",
  showTitle = true,
}) {
  const stations = flattenRouteStations(route?.segments);
  const [activeIndex, setActiveIndex] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (activeIndex == null) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setActiveIndex(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [activeIndex]);

  if (stations.length === 0) return null;

  const withNodes = variant === "nodes";
  const withDividers = variant === "dividers" || withNodes;
  const active = activeIndex != null ? stations[activeIndex] : null;
  const activeLevel = active ? rateToCrowdLevel(active.congestionRate) : null;
  const activeColor = activeLevel ? CROWD_COLORS[activeLevel] : null;

  return (
    <div ref={rootRef} className={className}>
      {showTitle && (
        <p className="mb-1.5 text-[10px] font-medium text-slate-500">역별 혼잡</p>
      )}
      <div className="relative">
        <div
          className={`relative flex h-3 overflow-hidden rounded-full ring-1 ring-slate-100 ${
            withNodes ? "overflow-visible" : ""
          }`}
          role="list"
          aria-label="경로 역별 혼잡"
          onMouseLeave={() => setActiveIndex(null)}
        >
          {stations.map((st, i) => {
            const level = rateToCrowdLevel(st.congestionRate);
            const showDivider = withDividers && i > 0;
            const label = formatStationLabel(st.name);
            return (
              <button
                key={`${st.name}-${i}`}
                type="button"
                role="listitem"
                aria-label={`${label} 혼잡 ${st.congestionRate}% ${CROWD_LABELS[level]}`}
                aria-pressed={activeIndex === i}
                className="relative min-w-0 flex-1 touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
                style={{ backgroundColor: CROWD_COLORS[level] }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((prev) => (prev === i ? null : i));
                }}
                onMouseEnter={() => setActiveIndex(i)}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {showDivider && (
                  <span
                    className="pointer-events-none absolute left-0 top-0 z-[1] h-full w-px bg-white/90"
                    aria-hidden
                  />
                )}
                {withNodes && i > 0 && (
                  <span
                    className="pointer-events-none absolute left-0 top-1/2 z-[2] h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm"
                    style={{ border: "2.2px solid #1a1a1a" }}
                    aria-hidden
                  />
                )}
                {withNodes && i === 0 && (
                  <span
                    className="pointer-events-none absolute left-0 top-1/2 z-[2] h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm"
                    style={{ border: "2.2px solid #1a1a1a" }}
                    aria-hidden
                  />
                )}
                {withNodes && i === stations.length - 1 && (
                  <span
                    className="pointer-events-none absolute right-0 top-1/2 z-[2] h-[9px] w-[9px] translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm"
                    style={{ border: "2.2px solid #1a1a1a" }}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>

        {active && activeColor && (
          <div
            className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[10px] font-medium text-white shadow-md"
            style={{
              left: `${((activeIndex + 0.5) / stations.length) * 100}%`,
            }}
            role="status"
          >
            {formatStationLabel(active.name)} · {active.congestionRate}%{" "}
            {CROWD_LABELS[activeLevel]}
            <span
              className="absolute left-1/2 top-full -mt-px -translate-x-1/2 border-4 border-transparent border-t-slate-800"
              aria-hidden
            />
          </div>
        )}
      </div>

      <div className={`mt-1 flex ${withNodes ? "px-0.5" : ""}`}>
        {stations.map((st, i) => (
          <div
            key={`lbl-${st.name}-${i}`}
            className="min-w-0 flex-1 overflow-hidden px-0.5"
          >
            {shouldLabel(stations, i) ? (
              <p className="truncate text-center text-[9px] leading-tight text-slate-500">
                {formatStationLabel(st.name, { suffix: false })}
              </p>
            ) : (
              <p className="text-center text-[9px] leading-tight text-transparent" aria-hidden>
                ·
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
