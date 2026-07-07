import stationsJson from "./generated/metro-stations.json";
import segmentsJson from "./generated/metro-line-segments.json";
import viewboxJson from "./generated/metro-viewbox.json";
const METRO_STATIONS = stationsJson;
const METRO_LINE_SEGMENTS = segmentsJson;
const MAP_VIEWBOX = viewboxJson;
const stationById = new Map(METRO_STATIONS.map((s) => [s.id, s]));
const stationByName = new Map(METRO_STATIONS.map((s) => [s.name, s]));
function getStation(id) {
  return stationById.get(id) ?? stationByName.get(id.replace(/역$/, ""));
}
function getStationByName(name) {
  const clean = name.replace(/역.*$/, "").trim();
  return stationByName.get(clean);
}
const LINE_COLOR_LABELS = {
  "#0054a6": "1호선",
  "#005daa": "1호선",
  "#00a44a": "2호선",
  "#f47d30": "3호선",
  "#00a9dc": "4호선",
  "#936fb1": "5호선",
  "#fda600": "5호선",
  "#ed8000": "6호선",
  "#677718": "7호선",
  "#ea545d": "8호선",
  "#c6b182": "9호선",
  "#9a6292": "신분당선",
  "#d31145": "경의중앙",
  "#178c72": "경춘선",
  "#6789ca": "공항철도",
  "#76c4a3": "경강선",
  "#4ea346": "우이신설",
  "#8fc31e": "2호선(성수지선)",
  "#b0ce18": "경의선",
  "#6fa0ce": "인천1",
  "#3681b7": "인천2",
  "#a4dcff": "인천공항",
  "#ad8605": "김포골드",
  "#f99d1c": "수인분당",
  "#c77539": "서해선"
};
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
    if (!byKey.has(key)) byKey.set(key, seg.color);
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
  let bestColor = "#0054a6";
  for (const seg of METRO_LINE_SEGMENTS) {
    const d = pointToSegmentDistance(x, y, seg);
    if (d < bestDist) {
      bestDist = d;
      bestColor = seg.color;
    }
  }
  return bestColor;
}
function getStationLineColor(x, y) {
  return getNearestSegmentColor(x, y);
}
function getSegmentCrowdLevel(seg, time) {
  if (seg.color.toLowerCase() !== "#00a44a") return null;
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
  getUniqueLineLegend,
  pointToSegmentDistance,
  segmentMatchesLine,
  washLineColor
};
