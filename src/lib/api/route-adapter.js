import { getStatusFromApiLevel, getStatusFromRate } from "@/lib/congestion";
import { apiCongestionToRate } from "@/lib/api/odsay-to-route";
import { colorForLineKey } from "@/lib/station-line-colors";
import { pruneNoRideSegments } from "@/lib/route-station-groups";
import { distributeStopOffsets, formatArrivalTime } from "@/lib/route-timing";

const API_LEVEL_BADGE = {
  여유: "여유",
  보통: "보통",
  혼잡: "혼잡",
  매우혼잡: "매우혼잡",
  극혼잡: "극혼잡",
  주의: "혼잡", // 구버전 호환
};

function lineNameToColor(lineName) {
  return colorForLineKey(lineName) ?? "#94a3b8";
}

function stationNamesKey(stations) {
  return (stations ?? []).map((s) => s.name).join("|");
}

function stationCongestionRate(st) {
  if (st.congestion_pct != null && Number.isFinite(Number(st.congestion_pct))) {
    return Math.round(Number(st.congestion_pct));
  }
  return apiCongestionToRate(st.station_congestion);
}

function stationCongestionStatus(st, rate) {
  if (st.level) return getStatusFromApiLevel(st.level);
  return getStatusFromRate(rate);
}

/**
 * @param {Array<{ name: string, line: string, station_congestion: number, is_transfer: boolean, station_id: string, arrival_offset_min?: number, heading?: string }>} apiStations
 * @param {Date} departureTime
 * @param {Array<{ afterStationIndex: number, minutes: number }>} walkTransfers
 */
export function buildSegmentsFromRouteStations(apiStations, departureTime, walkTransfers = []) {
  const segments = [];
  let current = null;
  const walkByIndex = new Map(
    walkTransfers.map((w) => [w.afterStationIndex, w.minutes]),
  );

  apiStations.forEach((st, i) => {
    const isFirst = i === 0;
    const isLast = i === apiStations.length - 1;
    let type = "waypoint";
    if (isFirst) type = "departure";
    else if (isLast) type = "arrival";
    else if (st.is_transfer) type = "transfer";

    const lineName = st.line;
    const lineColor = lineNameToColor(lineName);
    const congestionRate = stationCongestionRate(st);
    const offsetMin = st.arrival_offset_min ?? i * 3;

    if (!current || current.lineName !== lineName) {
      if (current && walkByIndex.has(i - 1)) {
        current.walkAfter = { minutes: walkByIndex.get(i - 1) };
      }
      current = { lineName, lineColor, stations: [] };
      segments.push(current);
    }

    current.stations.push({
      name: st.name,
      type,
      arrivalTime: formatArrivalTime(departureTime, offsetMin),
      congestionRate,
      congestionStatus: stationCongestionStatus(st, congestionRate),
      congestionLevel: st.level,
      congestionLabel: st.congestion_label,
      heading: st.heading,
    });
  });

  if (current && walkByIndex.has(apiStations.length - 1)) {
    current.walkAfter = { minutes: walkByIndex.get(apiStations.length - 1) };
  }

  for (const wt of walkTransfers) {
    const anchor = apiStations[wt.afterStationIndex]?.name;
    if (!anchor) continue;
    for (const seg of segments) {
      if (seg.stations.some((s) => s.name === anchor)) {
        seg.walkAfter = { minutes: wt.minutes };
        break;
      }
    }
  }

  return pruneNoRideSegments(segments);
}

function scaleSegments(segments, factor) {
  return segments.map((seg) => ({
    ...seg,
    stations: seg.stations.map((st) => {
      const congestionRate = Math.max(0, Math.round(st.congestionRate * factor));
      return {
        ...st,
        congestionRate,
        congestionStatus: getStatusFromRate(congestionRate),
      };
    }),
  }));
}

function buildStationPredictions(apiStations, departureTime, factor = 1) {
  return apiStations.map((st) => {
    const base = stationCongestionRate(st);
    const congestionRate = Math.max(0, Math.round(base * factor));
    const offsetMin = st.arrival_offset_min ?? 0;
    return {
      stationId: st.station_id,
      stationName: st.name,
      congestionRate,
      status: stationCongestionStatus(st, congestionRate),
      level: st.level,
      congestionLabel: st.congestion_label,
      heading: st.heading ?? "방면",
      arrivalTime: formatArrivalTime(departureTime, offsetMin),
    };
  });
}

function buildRouteFromResponse(apiResponse, departureTime, options) {
  const {
    id,
    label,
    badge,
    recommended,
    comfortFactor = 1,
    timeExtra = 0,
  } = options;
  const { summary, stations: apiStations = [], walk_transfers = [] } = apiResponse;
  const stationNames = apiStations.map((s) => s.name);
  const totalMin = Math.max(
    1,
    Number(summary?.total_time_min) || Math.max(1, apiStations.length - 1) * 3,
  );

  // ODsay total_time에 맞춰 역별 도착 오프셋 배분 (없으면 i*3 → 타임라인 왜곡)
  const hasOffsets = apiStations.some((s) => s.arrival_offset_min != null);
  const distributed = hasOffsets
    ? null
    : distributeStopOffsets(apiStations.length, totalMin);
  const stationsWithOffsets = distributed
    ? apiStations.map((st, i) => ({
        ...st,
        arrival_offset_min: distributed[i],
      }))
    : apiStations;

  const segments = buildSegmentsFromRouteStations(
    stationsWithOffsets,
    departureTime,
    walk_transfers,
  );
  const scaledSegments =
    comfortFactor === 1 ? segments : scaleSegments(segments, comfortFactor);
  const predictions = buildStationPredictions(
    stationsWithOffsets,
    departureTime,
    comfortFactor,
  );
  const maxCongestion = Math.max(...predictions.map((p) => p.congestionRate), 0);
  const departureCongestion = predictions[0]?.congestionRate ?? 0;
  const arrivalCongestion =
    predictions[predictions.length - 1]?.congestionRate ?? departureCongestion;

  const trainSegments = (apiResponse.segments ?? []).map((seg) => ({
    line: seg.line,
    fromStation: seg.from_station,
    toStation: seg.to_station,
    trainCongestion: apiCongestionToRate(seg.train_congestion),
    level: seg.level,
  }));

  return {
    id,
    label,
    badge: badge ?? API_LEVEL_BADGE[summary.overall_level] ?? summary.overall_level,
    totalTime: totalMin + timeExtra,
    payment: summary.payment ?? 1400,
    transfers: summary.transfer_count,
    lineName: segments[0]?.lineName ?? "지하철",
    maxCongestion,
    departureCongestion,
    arrivalCongestion,
    overallStatus:
      summary.overall_level != null
        ? getStatusFromApiLevel(summary.overall_level)
        : getStatusFromRate(maxCongestion),
    overallLevel: summary.overall_level,
    modelSource: summary.model_source,
    description: stationNames.join(" ─ "),
    stations: stationNames,
    stationPredictions: predictions,
    segments: scaledSegments,
    trainSegments,
    recommended,
    source: apiResponse.source ?? "api",
    routeKey: apiResponse.route_key ?? null,
    routeLabel: apiResponse.route_label ?? null,
  };
}

function isSamePath(a, b) {
  return stationNamesKey(a?.stations) === stationNamesKey(b?.stations);
}

function routeBodiesFromApiResponse(apiResponse) {
  const primary = {
    summary: apiResponse.summary,
    segments: apiResponse.segments ?? [],
    stations: apiResponse.stations ?? [],
    walk_transfers: apiResponse.walk_transfers ?? [],
    source: apiResponse.source,
    route_key: apiResponse.route_key ?? null,
    route_label: apiResponse.route_label ?? null,
  };

  const fromList = Array.isArray(apiResponse.alternatives)
    ? apiResponse.alternatives
    : [];
  const legacy = apiResponse.alternative ? [apiResponse.alternative] : [];

  const bodies = [primary, ...fromList, ...legacy];
  const unique = [];
  for (const body of bodies) {
    if (!body?.stations?.length && !body?.summary) continue;
    if (unique.some((u) => isSamePath(u, body))) continue;
    unique.push(body);
  }
  return unique;
}

function labelForRouteIndex(index, _total, body) {
  const minutes = body?.summary?.total_time_min;
  if (typeof minutes === "number") return `${minutes}분`;
  return index === 0 ? "최적" : "대안";
}

/**
 * RouteResponse (+ alternatives[]) → 추천 카드 N장
 */
export function adaptApiRouteResponse(apiResponse, departureTime) {
  const bodies = routeBodiesFromApiResponse(apiResponse);
  if (!bodies.length) return [];

  return bodies.map((body, index) => {
    const levelBadge =
      API_LEVEL_BADGE[body.summary?.overall_level] ?? body.summary?.overall_level ?? "경로";
    return buildRouteFromResponse(body, departureTime, {
      id: `route-${index}`,
      label: labelForRouteIndex(index, bodies.length, body),
      badge: levelBadge,
      recommended: index === 0,
    });
  });
}

export function buildUiRouteFromResponse(routeResponse, departureTime, options) {
  return buildRouteFromResponse(
    { ...routeResponse, source: "mock" },
    departureTime,
    options,
  );
}

export { lineNameToColor, API_LEVEL_BADGE };
