import { getStatusFromRate } from "@/lib/congestion";

const LINE_NAME_TO_COLOR = {
  "1호선": "#0054a6",
  "2호선": "#00a44a",
  "3호선": "#f47d30",
  "4호선": "#00a9dc",
  "5호선": "#fda600",
  "6호선": "#ed8000",
  "7호선": "#677718",
  "8호선": "#ea545d",
  "9호선": "#c6b182",
};

const API_LEVEL_BADGE = {
  여유: "여유",
  보통: "보통",
  주의: "혼잡 주의",
  혼잡: "혼잡",
};

function lineNameToColor(lineName) {
  return LINE_NAME_TO_COLOR[lineName] ?? "#94a3b8";
}

function apiCongestionToRate(value) {
  return Math.min(150, Math.round(Number(value) * 1.4));
}

function formatArrivalTime(departureTime, stopIndex) {
  const d = new Date(departureTime.getTime() + stopIndex * 3 * 60_000);
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * @param {Array<{ name: string, line: string, station_congestion: number, level: string, is_transfer: boolean, station_id: string }>} apiStations
 * @param {Date} departureTime
 */
function buildSegmentsFromApiStations(apiStations, departureTime) {
  const segments = [];
  let current = null;

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

    if (!current || current.lineName !== lineName) {
      current = { lineName, lineColor, stations: [] };
      segments.push(current);
    }

    current.stations.push({
      name: st.name,
      type,
      arrivalTime: formatArrivalTime(departureTime, i),
      congestionRate,
      congestionStatus: getStatusFromRate(congestionRate),
    });
  });

  return segments;
}

/**
 * @param {ReturnType<typeof buildSegmentsFromApiStations>} segments
 * @param {number} factor
 */
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

/**
 * @param {Array<{ station_id: string, name: string, station_congestion: number, level: string }>} apiStations
 * @param {Date} departureTime
 * @param {number} [factor=1]
 */
function buildStationPredictions(apiStations, departureTime, factor = 1) {
  return apiStations.map((st, idx) => {
    const congestionRate = Math.max(
      40,
      Math.round(apiCongestionToRate(st.station_congestion) * factor),
    );
    return {
      stationId: st.station_id,
      stationName: st.name,
      congestionRate,
      status: getStatusFromRate(congestionRate),
      heading: "방면",
      arrivalTime: formatArrivalTime(departureTime, idx),
    };
  });
}

/**
 * @param {object} apiResponse
 * @param {Date} departureTime
 */
function buildRouteFromApi(apiResponse, departureTime, options) {
  const { id, label, badge, recommended, comfortFactor = 1, timeExtra = 0 } = options;
  const { summary, stations: apiStations = [] } = apiResponse;
  const stationNames = apiStations.map((s) => s.name);
  const segments = buildSegmentsFromApiStations(apiStations, departureTime);
  const scaledSegments =
    comfortFactor === 1 ? segments : scaleSegments(segments, comfortFactor);
  const predictions = buildStationPredictions(apiStations, departureTime, comfortFactor);
  const maxCongestion = Math.max(...predictions.map((p) => p.congestionRate), 40);

  return {
    id,
    label,
    badge: badge ?? API_LEVEL_BADGE[summary.overall_level] ?? summary.overall_level,
    totalTime: summary.total_time_min + timeExtra,
    payment: 1400,
    transfers: summary.transfer_count,
    lineName: segments[0]?.lineName ?? "2호선",
    maxCongestion,
    overallStatus: getStatusFromRate(maxCongestion),
    description: stationNames.join(" ─ "),
    stations: stationNames,
    stationPredictions: predictions,
    segments: scaledSegments,
    recommended,
    source: "api",
  };
}

/**
 * FastAPI RouteResponse → 프론트 buildRoutes()와 동일한 2카드 배열
 * @param {object} apiResponse
 * @param {Date} departureTime
 */
export function adaptApiRouteResponse(apiResponse, departureTime) {
  const levelBadge = API_LEVEL_BADGE[apiResponse.summary?.overall_level] ?? "시간 우선";

  const fast = buildRouteFromApi(apiResponse, departureTime, {
    id: "fast",
    label: "최단 시간 경로",
    badge: levelBadge,
    recommended: false,
  });

  const comfort = buildRouteFromApi(apiResponse, departureTime, {
    id: "comfort",
    label: "추천 쾌적 경로",
    badge: "쾌적 우선",
    recommended: true,
    comfortFactor: 0.55,
    timeExtra: 7,
  });

  return [fast, comfort];
}
