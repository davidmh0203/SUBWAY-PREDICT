import { METRO_STATIONS, METRO_LINE_SEGMENTS, getLineKeyForColor, normalizeLineColor } from "./metro-network";
import { getStatusFromRate } from "./congestion";
import { pruneNoRideSegments } from "./route-station-groups";
import { getRegistryLines } from "./station-line-registry";
import { isSupportedSeoulLine } from "./seoul-metro-stations";
import {
  MOCK_MINUTES_PER_STOP,
  MOCK_WALK_TRANSFER_MINUTES,
  formatArrivalTime,
  estimateLocalRouteMinutes,
  estimateSubwayPayment,
} from "./route-timing";

let _graph = null;

const STATION_ON_SEGMENT_TOL = 10;
const SEGMENT_ENDPOINT_TOL = 12;

function pointToSegmentDistance(px, py, seg) {
  const { x1, y1, x2, y2 } = seg;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function projectionOnSegment(px, py, seg) {
  const { x1, y1, x2, y2 } = seg;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  return Math.max(0, Math.min(1, t));
}

function stationOnSegment(station, seg) {
  const nearStart =
    Math.hypot(seg.x1 - station.x, seg.y1 - station.y) < SEGMENT_ENDPOINT_TOL;
  const nearEnd =
    Math.hypot(seg.x2 - station.x, seg.y2 - station.y) < SEGMENT_ENDPOINT_TOL;
  const onSegment =
    pointToSegmentDistance(station.x, station.y, seg) < STATION_ON_SEGMENT_TOL;
  if (!(nearStart || nearEnd || onSegment)) return false;

  // 레지스트리에 호선이 있으면 해당 호선 세그먼트에만 연결 (고속터미널↔2호선 등 방지)
  const registry = getRegistryLines(station.name);
  if (registry?.length) {
    const lineKey = getLineKeyForColor(seg.color);
    if (!registry.includes(lineKey)) return false;
  }
  return true;
}

function addGraphEdge(graph, from, to, color) {
  if (from === to) return;
  for (const [a, b] of [
    [from, to],
    [to, from],
  ]) {
    if (!graph.has(a)) graph.set(a, []);
    const list = graph.get(a);
    if (!list.some((edge) => edge.neighborId === b && edge.color === color)) {
      list.push({ neighborId: b, color });
    }
  }
}

function buildGraph() {
  if (_graph) return _graph;
  const graph = /* @__PURE__ */ new Map();

  for (const seg of METRO_LINE_SEGMENTS) {
    if (!isSupportedSeoulLine(getLineKeyForColor(seg.color))) continue;
    const onSegment = [];
    for (const station of METRO_STATIONS) {
      if (stationOnSegment(station, seg)) {
        onSegment.push({
          id: station.id,
          t: projectionOnSegment(station.x, station.y, seg),
        });
      }
    }
    onSegment.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id, "ko"));
    for (let i = 0; i < onSegment.length - 1; i++) {
      addGraphEdge(graph, onSegment[i].id, onSegment[i + 1].id, seg.color);
    }
  }

  _graph = graph;
  return graph;
}

function dijkstra(graph, startId, endId, transferPenalty = 20) {
  const dist = /* @__PURE__ */ new Map();
  const prevStation = /* @__PURE__ */ new Map();
  const prevColor = /* @__PURE__ */ new Map();
  dist.set(startId, 0);
  const queue = [{ id: startId, lineColor: null, cost: 0 }];
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const { id, lineColor, cost } = queue.shift();
    if (id === endId) break;
    if (cost > (dist.get(id) ?? Infinity)) continue;
    for (const edge of graph.get(id) ?? []) {
      const edgeColor = normalizeLineColor(edge.color);
      const activeColor = lineColor ? normalizeLineColor(lineColor) : null;
      const transfer = activeColor && activeColor !== edgeColor ? transferPenalty : 0;
      const newCost = cost + 1 + transfer;
      if (newCost < (dist.get(edge.neighborId) ?? Infinity)) {
        dist.set(edge.neighborId, newCost);
        prevStation.set(edge.neighborId, id);
        prevColor.set(edge.neighborId, edge.color);
        queue.push({ id: edge.neighborId, lineColor: edgeColor, cost: newCost });
      }
    }
  }
  if (!prevStation.has(endId)) return null;
  const path = [];
  let cur = endId;
  while (cur !== startId) {
    path.unshift({ id: cur, lineColor: prevColor.get(cur) ?? "" });
    cur = prevStation.get(cur);
  }
  path.unshift({ id: startId, lineColor: path[0]?.lineColor ?? "" });
  return path;
}

function pathToSegments(path, targetTime) {
  const segments = [];
  let currentSeg = null;
  let offsetMin = 0;
  const walkTransfers = [];

  for (let i = 0; i < path.length; i++) {
    const { id, lineColor: rawLineColor } = path[i];
    const lineColor = normalizeLineColor(rawLineColor);
    const stationName = METRO_STATIONS.find((s) => s.id === id)?.name ?? id;
    const isFirst = i === 0;
    const isLast = i === path.length - 1;
    let type = "waypoint";
    if (isFirst) type = "departure";
    else if (isLast) type = "arrival";
    else if (currentSeg && currentSeg.lineColor !== lineColor) type = "transfer";

    if (type === "transfer" && currentSeg) {
      walkTransfers.push({
        afterStationIndex: i - 1,
        minutes: MOCK_WALK_TRANSFER_MINUTES,
      });
      offsetMin += MOCK_WALK_TRANSFER_MINUTES;
    }

    if (i > 0) offsetMin += MOCK_MINUTES_PER_STOP;

    const arrivalTime = formatArrivalTime(targetTime, offsetMin);
    const congestionRate = Math.round(50 + ((i * 17) % 60));
    const congestionStatus = getStatusFromRate(congestionRate);
    const station = {
      name: stationName,
      type,
      arrivalTime,
      arrival_offset_min: Math.round(offsetMin),
      congestionRate,
      congestionStatus,
    };

    if (!currentSeg || currentSeg.lineColor !== lineColor) {
      // 환승: 이전 노선 종착(옥수 등)을 새 노선 승차역으로도 넣어
      // 도착만 남은 1역 구간(응봉→응봉)이 생기지 않게 함
      if (currentSeg && currentSeg.stations.length) {
        const transferBoard = {
          ...currentSeg.stations[currentSeg.stations.length - 1],
          type: "transfer",
        };
        currentSeg = {
          lineName: getLineKeyForColor(rawLineColor),
          lineColor,
          stations: [transferBoard],
        };
      } else {
        currentSeg = {
          lineName: getLineKeyForColor(rawLineColor),
          lineColor,
          stations: [],
        };
      }
      segments.push(currentSeg);
    }
    currentSeg.stations.push(station);
  }

  for (const wt of walkTransfers) {
    const anchorIdx = wt.afterStationIndex;
    const anchorName = path[anchorIdx]
      ? (METRO_STATIONS.find((s) => s.id === path[anchorIdx].id)?.name ?? path[anchorIdx].id)
      : null;
    if (!anchorName) continue;
    for (const seg of segments) {
      if (seg.stations.some((s) => s.name === anchorName)) {
        seg.walkAfter = { minutes: wt.minutes };
        break;
      }
    }
  }

  return { segments: pruneNoRideSegments(segments), walkTransfers };
}

function resolveId(name) {
  const clean = name.replace(/역.*$/, "").trim();
  const base = clean.split("|")[0].trim();
  return METRO_STATIONS.find((s) => s.id === base || s.name === base)?.id;
}

function findPath(depName, destName, transferPenalty) {
  const depId = resolveId(depName);
  const destId = resolveId(destName);
  if (!depId || !destId) return null;
  const graph = buildGraph();
  return dijkstra(graph, depId, destId, transferPenalty);
}

function findRoute(depName, destName, targetTime, transferPenalty = 20) {
  const path = findPath(depName, destName, transferPenalty);
  if (!path) return null;
  const { segments, walkTransfers } = pathToSegments(path, targetTime);
  const transfers = Math.max(0, segments.length - 1);
  const stations = path.map(
    ({ id }) => METRO_STATIONS.find((s) => s.id === id)?.name ?? id,
  );
  const totalTime = estimateLocalRouteMinutes(path.length, transfers);
  const payment = estimateSubwayPayment(stations.length, transfers);
  return {
    segments,
    stations,
    transfers,
    totalStops: path.length,
    totalTime,
    payment,
    walkTransfers,
  };
}

/** 최단(낮은 환승 패널티) + 대안(높은 환승 패널티로 다른 경로 탐색) */
function findRouteVariants(depName, destName, targetTime) {
  const fast = findRoute(depName, destName, targetTime, 15);
  const alt = findRoute(depName, destName, targetTime, 45);
  const samePath =
    fast &&
    alt &&
    fast.stations.join("|") === alt.stations.join("|");
  return { fast, alt: samePath ? null : alt };
}

function routePrimaryColor(segments) {
  return segments[0]?.lineColor ?? "#94a3b8";
}

export { findRoute, findRouteVariants, routePrimaryColor };
