import stationsJson from "./generated/metro-stations.json";
import segmentsJson from "./generated/metro-line-segments.json";
import viewboxJson from "./generated/metro-viewbox.json";
import {
  SVG_HEX_TO_LINE_KEY,
  colorForLineKey,
  officialColorForSvgHex,
} from "./station-line-colors";

const METRO_STATIONS = stationsJson;
const METRO_LINE_SEGMENTS = segmentsJson;
const MAP_VIEWBOX = viewboxJson;
const stationById = new Map(METRO_STATIONS.map((s) => [s.id, s]));
const stationByName = new Map(METRO_STATIONS.map((s) => [s.name, s]));

const LINE_COLOR_LABELS = { ...SVG_HEX_TO_LINE_KEY };

function getStation(id) {
  return stationById.get(id) ?? stationByName.get(id.replace(/역$/, ""));
}
function getStationByName(name) {
  const clean = name.replace(/역.*$/, "").trim();
  return stationByName.get(clean);
}

function normalizeLineColor(color) {
  return officialColorForSvgHex(color);
}

function getLineKeyForColor(color) {
  return LINE_COLOR_LABELS[color.toLowerCase()] ?? color.toLowerCase();
}
function segmentMatchesLine(seg, lineKey) {
  if (!lineKey) return true;
  return getLineKeyForColor(seg.color) === lineKey;
}
function washLineColor(hex, whiteMix = 0.82) {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return "#e8eaed";
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const mix = (channel) => Math.round(channel + (255 - channel) * whiteMix);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
function getUniqueLineLegend() {
  const byKey = /* @__PURE__ */ new Map();
  for (const seg of METRO_LINE_SEGMENTS) {
    const key = getLineKeyForColor(seg.color);
    if (!byKey.has(key)) byKey.set(key, colorForLineKey(key));
  }
  return [...byKey.entries()].map(([lineKey, color]) => ({ lineKey, color, name: lineKey })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
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
function getNearestSegmentColor(x, y) {
  let bestDist = Infinity;
  let bestColor = colorForLineKey("1호선");
  for (const seg of METRO_LINE_SEGMENTS) {
    const d = pointToSegmentDistance(x, y, seg);
    if (d < bestDist) {
      bestDist = d;
      bestColor = normalizeLineColor(seg.color);
    }
  }
  return bestColor;
}
function getStationLineColor(x, y) {
  return getNearestSegmentColor(x, y);
}

function stationToPseudoGeo(station) {
  const minX = 560;
  const maxX = 1020;
  const minY = 330;
  const maxY = 700;
  const lng = 126.82 + ((station.x - minX) / (maxX - minX)) * 0.42;
  const lat = 37.72 - ((station.y - minY) / (maxY - minY)) * 0.27;
  return { lat, lng };
}

function getNearestStationsByGeo(lat, lng, limit = 5) {
  const withDist = METRO_STATIONS.map((station) => {
    const pseudo = stationToPseudoGeo(station);
    const dLat = lat - pseudo.lat;
    const dLng = lng - pseudo.lng;
    return { station, distance: Math.hypot(dLat, dLng) };
  });
  return withDist
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((x) => x.station);
}
function getSegmentCrowdLevel(seg, time) {
  if (getLineKeyForColor(seg.color) !== "2호선") return null;
  const mx = (seg.x1 + seg.x2) / 2;
  const my = (seg.y1 + seg.y2) / 2;
  if (mx < 560 || mx > 1e3 || my < 530 || my > 680) return null;
  const levels = {
    "17:30": "BUSY",
    "18:00": "VERY_BUSY",
    "18:30": "VERY_BUSY",
    "19:00": "BUSY",
    "19:30": "NORMAL"
  };
  return levels[time] ?? null;
}
export {
  LINE_COLOR_LABELS,
  MAP_VIEWBOX,
  METRO_LINE_SEGMENTS,
  METRO_STATIONS,
  getLineKeyForColor,
  getNearestSegmentColor,
  getSegmentCrowdLevel,
  getStation,
  getStationByName,
  getStationLineColor,
  getNearestStationsByGeo,
  normalizeLineColor,
  getUniqueLineLegend,
  pointToSegmentDistance,
  segmentMatchesLine,
  stationToPseudoGeo,
  washLineColor
};
