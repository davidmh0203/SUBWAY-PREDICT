import { getStatusFromRate } from "@/lib/congestion";
import {
  apiCongestionToRate,
} from "@/lib/api/odsay-to-route";
import { colorForLineKey } from "@/lib/station-line-colors";
import { formatArrivalTime } from "@/lib/route-timing";

const API_LEVEL_BADGE = {
  여유: "여유",
  보통: "보통",
  주의: "혼잡 주의",
  혼잡: "혼잡",
};

function lineNameToColor(lineName) {
  return colorForLineKey(lineName) ?? "#94a3b8";
}

function stationNamesKey(stations) {
  return (stations ?? []).map((s) => s.name).join("|");
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
    const congestionRate = apiCongestionToRate(st.station_congestion);
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
      congestionStatus: getStatusFromRate(congestionRate),
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

  return segments;
}

function scaleSegments(segments, factor) {
  return segments.map((seg) => ({
    ...seg,
    stations: seg.stations.map((st) => {
      const congestionRate = Math.max(40, Math.round(st.congestionRate * factor));
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
    const congestionRate = Math.max(
      40,
      Math.round(apiCongestionToRate(st.station_congestion) * factor),
    );
    const offsetMin = st.arrival_offset_min ?? 0;
    return {
      stationId: st.station_id,
      stationName: st.name,
      congestionRate,
      status: getStatusFromRate(congestionRate),
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
  const segments = buildSegmentsFromRouteStations(
    apiStations,
    departureTime,
    walk_transfers,
  );
  const scaledSegments =
    comfortFactor === 1 ? segments : scaleSegments(segments, comfortFactor);
  const predictions = buildStationPredictions(apiStations, departureTime, comfortFactor);
  const maxCongestion = Math.max(...predictions.map((p) => p.congestionRate), 40);

  return {
    id,
    label,
    badge: badge ?? API_LEVEL_BADGE[summary.overall_level] ?? summary.overall_level,
    totalTime: summary.total_time_min + timeExtra,
    payment: summary.payment ?? 1400,
    transfers: summary.transfer_count,
    lineName: segments[0]?.lineName ?? "2호선",
    maxCongestion,
    overallStatus: getStatusFromRate(maxCongestion),
    description: stationNames.join(" ─ "),
    stations: stationNames,
    stationPredictions: predictions,
    segments: scaledSegments,
    recommended,
    source: apiResponse.source ?? "api",
  };
}

function isSamePath(a, b) {
  return stationNamesKey(a?.stations) === stationNamesKey(b?.stations);
}

/**
 * RouteResponse (+ optional alternative) → 추천 2카드
 * @param {object} apiResponse
 * @param {Date} departureTime
 */
export function adaptApiRouteResponse(apiResponse, departureTime) {
  const levelBadge =
    API_LEVEL_BADGE[apiResponse.summary?.overall_level] ?? "시간 우선";

  const fast = buildRouteFromResponse(apiResponse, departureTime, {
    id: "fast",
    label: "최단 시간 경로",
    badge: levelBadge,
    recommended: false,
  });

  const altBody = apiResponse.alternative;
  if (altBody && !isSamePath(apiResponse, altBody)) {
    const alt = buildRouteFromResponse(altBody, departureTime, {
      id: "alt",
      label: "대안 경로",
      badge: API_LEVEL_BADGE[altBody.summary?.overall_level] ?? "환승·경로 대안",
      recommended: true,
    });
    return [fast, alt];
  }

  const comfort = buildRouteFromResponse(apiResponse, departureTime, {
    id: "comfort",
    label: "추천 쾌적 경로",
    badge: "쾌적 우선",
    recommended: true,
    comfortFactor: 0.55,
    timeExtra: 0,
  });

  return [fast, comfort];
}

/**
 * 로컬/목업 RouteResponse 형태 → UiRoute 1건
 */
export function buildUiRouteFromResponse(routeResponse, departureTime, options) {
  return buildRouteFromResponse(
    { ...routeResponse, source: "mock" },
    departureTime,
    options,
  );
}

export { lineNameToColor, API_LEVEL_BADGE };
