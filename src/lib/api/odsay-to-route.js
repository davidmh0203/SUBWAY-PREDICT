import { getStatusFromRate } from "@/lib/congestion";
import { estimateSubwayPayment, distributeStopOffsets } from "@/lib/route-timing";

const LINE_PATTERN =
  /(\d+호선|신분당선|경의중앙선|공항철도|경춘선|수인분당선|수인\.분당선|에버라인|우이신설|김포골드|신림선|GTX-[A-Z]|서해선)/;

export function lineLabelFromLane(laneName) {
  if (!laneName) return "지하철";
  const match = laneName.match(LINE_PATTERN);
  if (match) {
    return match[1].replace("수인.분당선", "수인분당선");
  }
  return laneName.replace("수도권 ", "");
}

function mockCongestion(hour, index) {
  let base = 42;
  if ([7, 8, 9, 18, 19, 20].includes(hour)) base = 82;
  else if ([6, 10, 17, 21, 22].includes(hour)) base = 60;
  return Math.min(base + index * 4, 100);
}

function congestionLevel(value) {
  const pct = Number(value) || 0;
  if (pct >= 100) return "극혼잡";
  if (pct >= 80) return "매우혼잡";
  if (pct >= 60) return "혼잡";
  if (pct >= 30) return "보통";
  return "여유";
}

function laneNameFromSubPath(subPath) {
  const lane = subPath.lane;
  if (Array.isArray(lane)) return lineLabelFromLane(lane[0]?.name);
  return lineLabelFromLane(lane?.name);
}

function stopsFromSubPath(subPath) {
  const listed = subPath.passStopList?.stations;
  const startEnd =
    subPath.startName && subPath.endName
      ? [
          { stationName: subPath.startName, stationID: subPath.startID ?? "" },
          { stationName: subPath.endName, stationID: subPath.endID ?? "" },
        ]
      : null;

  // passStopList가 1역만 오면 승차=하차 가짜 구간이 생김 → start/end로 보정
  if (listed?.length >= 2) return listed;
  if (startEnd && startEnd[0].stationName !== startEnd[1].stationName) {
    return startEnd;
  }
  if (listed?.length) return listed;
  return startEnd ?? [];
}

function isNoOpSubwaySubPath(subPath) {
  const start = subPath.startName?.trim();
  const end = subPath.endName?.trim();
  if (start && end && start === end) {
    const listed = subPath.passStopList?.stations ?? [];
    if (listed.length <= 1) return true;
    if (listed.every((s) => s.stationName === start)) return true;
  }
  return false;
}

/**
 * ODsay path[] 항목 하나 → RouteResponse 형태
 * @param {object} pathItem
 * @param {{ start: string, end: string, departureTime: Date }} options
 */
export function parseOdsayPathItem(pathItem, options) {
  const { departureTime } = options;
  const hour = departureTime.getHours();
  const info = pathItem.info ?? {};
  const subPaths = pathItem.subPath ?? [];

  const stations = [];
  const walkTransfers = [];
  const edgeSegments = [];
  let offsetMin = 0;
  let subwayLegIndex = 0;

  subPaths.forEach((sp) => {
    const trafficType = sp.trafficType;
    const sectionTime = Number(sp.sectionTime) || 0;

    if (trafficType === 3) {
      if (stations.length > 0) {
        walkTransfers.push({
          afterStationIndex: stations.length - 1,
          minutes: sectionTime,
        });
      }
      offsetMin += sectionTime;
      return;
    }

    if (trafficType !== 1) return;

    // 승차=하차 0정차 열차 — 도보로 취급
    if (isNoOpSubwaySubPath(sp)) {
      if (stations.length > 0 && sectionTime > 0) {
        walkTransfers.push({
          afterStationIndex: stations.length - 1,
          minutes: sectionTime,
        });
      }
      offsetMin += sectionTime;
      return;
    }

    const lineName = laneNameFromSubPath(sp);
    const stops = stopsFromSubPath(sp);
    if (stops.length < 2) {
      if (stations.length > 0 && sectionTime > 0) {
        walkTransfers.push({
          afterStationIndex: stations.length - 1,
          minutes: Math.max(sectionTime, 1),
        });
      }
      offsetMin += sectionTime;
      return;
    }
    const way = sp.way ? `${sp.way} 방면` : undefined;
    const stopOffsets = distributeStopOffsets(stops.length, sectionTime);
    const legStartOffset = offsetMin;

    stops.forEach((stop, i) => {
      const arrivalOffset = Math.round(legStartOffset + stopOffsets[i]);
      const isTransfer =
        stations.length > 0 &&
        i === 0 &&
        stations[stations.length - 1].name !== stop.stationName;

      if (
        stations.length > 0 &&
        stations[stations.length - 1].name === stop.stationName
      ) {
        stations[stations.length - 1].is_transfer = true;
        stations[stations.length - 1].line = lineName;
        if (way) stations[stations.length - 1].heading = way;
        stations[stations.length - 1].arrival_offset_min = arrivalOffset;
        return;
      }

      const congestion = mockCongestion(hour, stations.length);
      stations.push({
        station_id: String(stop.stationID ?? ""),
        name: stop.stationName,
        line: lineName,
        station_congestion: congestion,
        level: congestionLevel(congestion),
        is_transfer: isTransfer,
        arrival_offset_min: arrivalOffset,
        heading: way,
      });
    });

    for (let i = 0; i < stops.length - 1; i += 1) {
      const a = stops[i];
      const b = stops[i + 1];
      const c = mockCongestion(hour, edgeSegments.length);
      edgeSegments.push({
        line: lineName,
        from_station: a.stationName,
        to_station: b.stationName,
        train_congestion: c,
        level: congestionLevel(c),
      });
    }

    offsetMin += sectionTime;
    subwayLegIndex += 1;
  });

  if (stations.length > 0) {
    stations[0].is_transfer = false;
  }

  const overall = Math.min(mockCongestion(hour, 0) + 6, 100);

  return {
    start: options.start,
    end: options.end,
    departure_time: departureTime.toISOString(),
    summary: {
      total_time_min: Number(info.totalTime) || offsetMin,
      transfer_count: Number(info.subwayTransitCount) || 0,
      payment:
        Number(info.payment) ||
        estimateSubwayPayment(stations.length, Number(info.subwayTransitCount) || 0),
      overall_congestion: overall,
      overall_level: congestionLevel(overall),
    },
    segments: edgeSegments,
    stations,
    walk_transfers: walkTransfers,
  };
}

/**
 * ODsay result 객체 → primary + alternatives[]
 * @param {object} result - data.result
 * @param {{ start: string, end: string, departureTime: Date }} options
 */
export function parseOdsayResult(result, options) {
  const paths = result?.path ?? [];
  if (!paths.length) {
    throw new Error("ODsay 경로 결과가 없습니다.");
  }

  const parsed = [];
  const seen = new Set();
  for (const pathItem of paths) {
    const body = parseOdsayPathItem(pathItem, options);
    const key = (body.stations ?? []).map((s) => s.name).join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    parsed.push(body);
  }

  if (!parsed.length) {
    throw new Error("유효한 ODsay 경로가 없습니다.");
  }

  const [primary, ...alternatives] = parsed;
  return { primary, alternatives };
}

/** API/모델 혼잡도 % → UI rate (모델 congestion_pct와 동일 스케일) */
export function apiCongestionToRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function getStatusFromCongestion(value) {
  return getStatusFromRate(apiCongestionToRate(value));
}
