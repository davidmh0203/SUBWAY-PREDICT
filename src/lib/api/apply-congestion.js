import { getStatusFromApiLevel, getStatusFromRate } from "@/lib/congestion";
import {
  getArrivalCongestion,
  getDepartureCongestion,
} from "@/lib/route-congestion-summary";

/**
 * 경로 UI 객체에 역별 혼잡 맵을 덮어쓴다 (ODsay 경로 유지).
 * @param {object[]} routes
 * @param {Record<string, { rate: number, level?: string, cause?: string | null }>} byName
 */
export function applyCongestionMapToRoutes(routes, byName) {
  if (!routes?.length || !byName) return routes;

  return routes.map((route) => {
    const predictions = (route.stationPredictions ?? []).map((p) => {
      const hit = byName[p.stationName];
      if (!hit) return p;
      const congestionRate = hit.rate;
      return {
        ...p,
        congestionRate,
        level: hit.level ?? p.level,
        cause: hit.cause !== undefined ? hit.cause : p.cause,
        status: hit.level
          ? getStatusFromApiLevel(hit.level)
          : getStatusFromRate(congestionRate),
      };
    });

    const segments = (route.segments ?? []).map((seg) => ({
      ...seg,
      stations: (seg.stations ?? []).map((st) => {
        const hit = byName[st.name];
        if (!hit) return st;
        const congestionRate = hit.rate;
        return {
          ...st,
          congestionRate,
          congestionLevel: hit.level ?? st.congestionLevel,
          cause: hit.cause !== undefined ? hit.cause : st.cause,
          congestionStatus: hit.level
            ? getStatusFromApiLevel(hit.level)
            : getStatusFromRate(congestionRate),
        };
      }),
    }));

    const rates = predictions.map((p) => p.congestionRate);
    const maxCongestion = rates.length ? Math.max(...rates) : route.maxCongestion;
    const top = predictions.reduce(
      (a, b) => ((a?.congestionRate ?? -1) >= (b?.congestionRate ?? -1) ? a : b),
      null,
    );

    const patched = {
      ...route,
      stationPredictions: predictions,
      segments,
      maxCongestion,
      overallLevel: top?.level ?? route.overallLevel,
      overallStatus: top?.level
        ? getStatusFromApiLevel(top.level)
        : getStatusFromRate(maxCongestion),
      modelSource: "model",
    };

    return {
      ...patched,
      departureCongestion: getDepartureCongestion(patched),
      arrivalCongestion: getArrivalCongestion(patched),
    };
  });
}

export function collectStationNamesFromRoutes(routes) {
  const names = [];
  for (const route of routes ?? []) {
    for (const p of route.stationPredictions ?? []) {
      if (p.stationName) names.push(p.stationName);
    }
    for (const seg of route.segments ?? []) {
      for (const st of seg.stations ?? []) {
        if (st.name) names.push(st.name);
      }
    }
  }
  return [...new Set(names)];
}
