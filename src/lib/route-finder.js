import { METRO_STATIONS, METRO_LINE_SEGMENTS, LINE_COLOR_LABELS } from "./metro-network";
import { getStatusFromRate } from "./congestion";
let _graph = null;
function buildGraph() {
  if (_graph) return _graph;
  const coordMap = /* @__PURE__ */ new Map();
  for (const st of METRO_STATIONS) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const key = `${Math.round(st.x) + dx}_${Math.round(st.y) + dy}`;
        if (!coordMap.has(key)) coordMap.set(key, st.id);
      }
    }
  }
  function nearestStation(x, y) {
    for (let r = 0; r <= 3; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const id = coordMap.get(`${Math.round(x) + dx}_${Math.round(y) + dy}`);
          if (id) return id;
        }
      }
    }
    return void 0;
  }
  const graph = /* @__PURE__ */ new Map();
  for (const seg of METRO_LINE_SEGMENTS) {
    const a = nearestStation(seg.x1, seg.y1);
    const b = nearestStation(seg.x2, seg.y2);
    if (!a || !b || a === b) continue;
    for (const [from, to] of [[a, b], [b, a]]) {
      if (!graph.has(from)) graph.set(from, []);
      const list = graph.get(from);
      if (!list.some((e) => e.neighborId === to && e.color === seg.color)) {
        list.push({ neighborId: to, color: seg.color });
      }
    }
  }
  _graph = graph;
  return graph;
}
function dijkstra(graph, startId, endId) {
  const TRANSFER_PENALTY = 20;
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
      const transfer = lineColor && lineColor !== edge.color ? TRANSFER_PENALTY : 0;
      const newCost = cost + 1 + transfer;
      if (newCost < (dist.get(edge.neighborId) ?? Infinity)) {
        dist.set(edge.neighborId, newCost);
        prevStation.set(edge.neighborId, id);
        prevColor.set(edge.neighborId, edge.color);
        queue.push({ id: edge.neighborId, lineColor: edge.color, cost: newCost });
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
  for (let i = 0; i < path.length; i++) {
    const { id, lineColor } = path[i];
    const stationName = METRO_STATIONS.find((s) => s.id === id)?.name ?? id;
    const isFirst = i === 0;
    const isLast = i === path.length - 1;
    let type = "waypoint";
    if (isFirst) type = "departure";
    else if (isLast) type = "arrival";
    else if (currentSeg && currentSeg.lineColor !== lineColor) type = "transfer";
    const arrivalDate = new Date(targetTime.getTime() + i * 3 * 6e4);
    const arrivalTime = arrivalDate.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const congestionRate = Math.round(50 + Math.random() * 60);
    const congestionStatus = getStatusFromRate(congestionRate);
    const station = {
      name: stationName,
      type,
      arrivalTime,
      congestionRate,
      congestionStatus
    };
    if (!currentSeg || type === "transfer" && currentSeg.lineColor !== lineColor) {
      currentSeg = {
        lineName: LINE_COLOR_LABELS[lineColor] ?? lineColor,
        lineColor,
        stations: []
      };
      segments.push(currentSeg);
    }
    currentSeg.stations.push(station);
  }
  return segments;
}
function resolveId(name) {
  const clean = name.replace(/역.*$/, "").trim();
  return METRO_STATIONS.find((s) => s.id === clean || s.name === clean)?.id;
}
function findRoute(depName, destName, targetTime) {
  const depId = resolveId(depName);
  const destId = resolveId(destName);
  if (!depId || !destId) return null;
  const graph = buildGraph();
  const path = dijkstra(graph, depId, destId);
  if (!path) return null;
  const segments = pathToSegments(path, targetTime);
  const transfers = Math.max(0, segments.length - 1);
  const stations = path.map(
    ({ id }) => METRO_STATIONS.find((s) => s.id === id)?.name ?? id
  );
  return { segments, stations, transfers, totalStops: path.length };
}
function routePrimaryColor(segments) {
  return segments[0]?.lineColor ?? "#94a3b8";
}
export {
  findRoute,
  routePrimaryColor
};
