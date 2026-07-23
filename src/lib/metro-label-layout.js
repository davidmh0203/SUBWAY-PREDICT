import {
  METRO_LINE_SEGMENTS,
  getLineKeyForColor,
  getNearestSegmentColor,
  normalizeLineColor,
} from "./metro-network";
import { getLineEndBadges } from "./metro-line-badges";
import { getRegistryLines } from "./station-line-registry";
import { colorForLineKey } from "./station-line-colors";
import { isSupportedSeoulLine } from "./seoul-metro-stations";
import svgLabelPositions from "./generated/metro-label-positions.json";

const BASE_STATION_R = 4.5;
const TRANSFER_STATION_R = BASE_STATION_R;
const ENDPOINT_TOL = 8;
const MAX_LABEL_DISTANCE = 28;
const MIN_OWNERSHIP_MARGIN = 2;
const LABEL_OVERRIDES = {
  김포공항: { x: 378, y: 472, anchor: "end", rotate: -38 },
  공항시장: { x: 432, y: 454, anchor: "start", rotate: -38 },
  마곡나루: { x: 484, y: 448, anchor: "start", rotate: -38 },
  신방화: { x: 460, y: 442, anchor: "end", rotate: -38 },
  개화산: { x: 412, y: 418, anchor: "end", rotate: -38 },
  송정: { x: 452, y: 462, anchor: "start", rotate: -38 },
  마곡: { x: 484, y: 456, anchor: "start", rotate: -38 },
  방화: { x: 438, y: 432, anchor: "start", rotate: -38 },
  구의: { x: 952.35, y: 551.3, anchor: "start", rotate: -45 },
  아차산: { x: 957.14, y: 535.5, anchor: "start", rotate: -45 },
  가산디지털단지: { x: 582, y: 641, anchor: "start", rotate: -45 },
  서울대: { x: 712, y: 638, anchor: "start", rotate: -45 },
  남성: { x: 739, y: 622, anchor: "start", rotate: -45 },
  봉천: { x: 690.35, y: 625.3, anchor: "start", rotate: -45 },
  남구로: { x: 577, y: 623, anchor: "end", rotate: -45 },
  신풍: { x: 622.5, y: 600, anchor: "start", rotate: -45 },
  오목교: { x: 568.5, y: 554.5, anchor: "start", rotate: -45 },
  양평: { x: 587.5, y: 554.5, anchor: "start", rotate: -45 },
  숭실대입구: { x: 693.14, y: 612.5, anchor: "start", rotate: -45 },
  석바위시장: { x: 206, y: 717.5, anchor: "end", rotate: -45 },
  검단사거리: { x: 105.5, y: 406, anchor: "start", rotate: -45 },
};
function isLabelOwnedByStation(station, lx, ly, allStations, margin = MIN_OWNERSHIP_MARGIN) {
  const ownDist = Math.hypot(lx - station.x, ly - station.y);
  if (ownDist > MAX_LABEL_DISTANCE) return false;
  for (const other of allStations) {
    if (other.id === station.id) continue;
    const otherDist = Math.hypot(lx - other.x, ly - other.y);
    if (otherDist + margin < ownDist) return false;
  }
  return true;
}
function getSvgLabelDefault(station) {
  return (
    LABEL_OVERRIDES[station.id] ??
    svgLabelPositions[station.id] ?? {
      x: station.x + 12,
      y: station.y - 10,
      anchor: "start",
      rotate: -45,
    }
  );
}
function colorToLineKey(color) {
  return getLineKeyForColor(color);
}
function getStationMarkerRadius(meta) {
  return meta.isTransfer ? TRANSFER_STATION_R : BASE_STATION_R;
}
function markerOverlap(cx, cy, meta, box, pad) {
  return circleRectOverlap(cx, cy, getStationMarkerRadius(meta), box, pad);
}
function computeAllStationMeta(stations) {
  const map = /* @__PURE__ */ new Map();
  for (const station of stations) {
    const endpointColors = /* @__PURE__ */ new Set();
    for (const seg of METRO_LINE_SEGMENTS) {
      const nearStart = Math.hypot(seg.x1 - station.x, seg.y1 - station.y) < ENDPOINT_TOL;
      const nearEnd = Math.hypot(seg.x2 - station.x, seg.y2 - station.y) < ENDPOINT_TOL;
      const onSegment =
        pointToSegmentDistance(station.x, station.y, seg) < (seg.width ?? 3) / 2 + 2;
      if (nearStart || nearEnd || onSegment) endpointColors.add(seg.color.toLowerCase());
    }
    const colorByKey = /* @__PURE__ */ new Map();
    for (const color of endpointColors) {
      const key = colorToLineKey(color);
      if (!colorByKey.has(key)) colorByKey.set(key, color);
    }
    let lineKeys = [...colorByKey.keys()].sort((a, b) => a.localeCompare(b, "ko"));
    let lineColors = lineKeys.map((key) => normalizeLineColor(colorByKey.get(key)));

    const registryLines = getRegistryLines(station.name);
    if (registryLines) {
      lineKeys = registryLines;
      lineColors = registryLines.map((key) => colorForLineKey(key));
    }

    lineKeys = lineKeys.filter((key) => isSupportedSeoulLine(key));
    lineColors = lineKeys.map((key) => colorForLineKey(key));

    const isTransfer = lineKeys.length >= 2;
    const lineColor =
      lineKeys.length > 0
        ? colorForLineKey(lineKeys[0]).toLowerCase()
        : getNearestSegmentColor(station.x, station.y).toLowerCase();
    map.set(station.id, { isTransfer, lineColor, lineKeys, lineColors });
  }
  return map;
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
function labelNearAnyLine(lx, ly, name, rotate, anchor, pad) {
  const box = labelBox(lx, ly, name, rotate, anchor);
  const samples = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
    [box.x + box.w / 2, box.y + box.h / 2],
    [lx, ly]
  ];
  let penalty = 0;
  for (const seg of METRO_LINE_SEGMENTS) {
    const threshold = (seg.width ?? 3) / 2 + pad;
    for (const [sx, sy] of samples) {
      const d = pointToSegmentDistance(sx, sy, seg);
      if (d < threshold) penalty += (threshold - d) * 12;
    }
  }
  return penalty;
}
function labelBox(lx, ly, name, rotate, anchor) {
  const charW = 5.2;
  const w = name.length * charW + 6;
  const h = 8;
  let x = lx;
  if (anchor === "middle") x -= w / 2;
  else if (anchor === "end") x -= w;
  if (Math.abs(rotate) < 1) {
    return { x, y: ly - h / 2, w, h };
  }
  const diag = Math.max(w, h) * 0.9;
  return { x: lx - diag / 2, y: ly - diag / 2, w: diag, h: diag };
}
function boxesOverlap(a, b, pad = 3) {
  return !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x || a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);
}
function circleRectOverlap(cx, cy, r, box, pad = 4) {
  const nx = Math.max(box.x - pad, Math.min(cx, box.x + box.w + pad));
  const ny = Math.max(box.y - pad, Math.min(cy, box.y + box.h + pad));
  return Math.hypot(cx - nx, cy - ny) < r + pad;
}
const CANDIDATES = (() => {
  const out = [];
  const dists = [10, 13, 16, 19, 23, 27];
  for (let deg = 0; deg < 360; deg += 20) {
    const rad = (deg * Math.PI) / 180;
    for (const dist of dists) {
      const ox = Math.cos(rad) * dist;
      const oy = Math.sin(rad) * dist;
      out.push({
        ox,
        oy,
        anchor: ox > 4 ? "start" : ox < -4 ? "end" : "middle",
        rotate: -45,
      });
    }
  }
  return out;
})();

/** 8방위 직교 우선 — 노드 앵커, 짧은 leader */
const ORTHOGONAL_CANDIDATES = (() => {
  const out = [];
  const dirs = [
    { deg: 0, rotate: 0, weight: 0 },
    { deg: 180, rotate: 0, weight: 0 },
    { deg: 90, rotate: 0, weight: 0 },
    { deg: 270, rotate: 0, weight: 0 },
    { deg: 45, rotate: -45, weight: 8 },
    { deg: 135, rotate: -45, weight: 8 },
    { deg: 225, rotate: -45, weight: 8 },
    { deg: 315, rotate: -45, weight: 8 },
  ];
  const dists = [9, 12, 15, 18, 22, 26];
  for (const dir of dirs) {
    const rad = (dir.deg * Math.PI) / 180;
    for (const dist of dists) {
      const ox = Math.cos(rad) * dist;
      const oy = Math.sin(rad) * dist;
      out.push({
        ox,
        oy,
        anchor: ox > 3 ? "start" : ox < -3 ? "end" : "middle",
        rotate: dir.rotate,
        orthoPenalty: dir.weight,
      });
    }
  }
  return out;
})();

function countNearbyStations(station, allStations, radius = 18) {
  let count = 0;
  for (const other of allStations) {
    if (other.id === station.id) continue;
    if (Math.hypot(other.x - station.x, other.y - station.y) < radius) count += 1;
  }
  return count;
}

function buildLayoutCandidates(station, stationMeta, layoutMode = "classic") {
  const scale = 1 + (stationMeta.isTransfer ? 0.2 : 0);

  if (layoutMode === "orthogonal") {
    // SVG 텍스트 앵커 의존 축소 — 노드 기준으로만 후보 생성
    return ORTHOGONAL_CANDIDATES.map((cand) => ({
      lx: station.x + cand.ox * scale,
      ly: station.y + cand.oy * scale,
      anchor: cand.anchor,
      rotate: cand.rotate,
      fromSvg: false,
      orthoPenalty: cand.orthoPenalty ?? 0,
    }));
  }

  const svg = getSvgLabelDefault(station);
  const out = [
    { lx: svg.x, ly: svg.y, anchor: svg.anchor, rotate: svg.rotate, fromSvg: true, orthoPenalty: 0 },
  ];
  for (const cand of CANDIDATES) {
    out.push({
      lx: station.x + cand.ox * scale,
      ly: station.y + cand.oy * scale,
      anchor: cand.anchor,
      rotate: cand.rotate,
      fromSvg: false,
      orthoPenalty: 0,
    });
  }
  return out;
}
function scoreLabelCandidate(
  station,
  stationMeta,
  lx,
  ly,
  rotate,
  anchor,
  placedBoxes,
  fromSvg,
  allStations,
  orthoPenalty = 0,
) {
  const box = labelBox(lx, ly, station.name, rotate, anchor);
  if (!isLabelOwnedByStation(station, lx, ly, allStations)) {
    return { blocked: true, score: Infinity };
  }
  let score = fromSvg ? -40 : 0;
  score += orthoPenalty;
  let hardBlock = false;
  if (markerOverlap(station.x, station.y, stationMeta, box, 2)) {
    score += 80;
    if (markerOverlap(station.x, station.y, stationMeta, box, -1)) hardBlock = true;
  }
  for (const other of allStations) {
    if (other.id === station.id) continue;
    const otherMeta = {
      isTransfer: false,
      lineColor: "#64748b",
      lineKeys: [],
      lineColors: [],
    };
    const otherDist = Math.hypot(lx - other.x, ly - other.y);
    const ownDist = Math.hypot(lx - station.x, ly - station.y);
    if (otherDist < ownDist) score += 220;
    if (markerOverlap(other.x, other.y, otherMeta, box, 1)) {
      score += 160;
      if (markerOverlap(other.x, other.y, otherMeta, box, -2)) hardBlock = true;
    }
  }
  for (const pb of placedBoxes) {
    if (boxesOverlap(box, pb, 1)) {
      score += 140;
      if (boxesOverlap(box, pb, -1)) hardBlock = true;
    }
  }
  for (const badge of getLineEndBadges()) {
    const br = badge.label.length <= 2 ? 8 : 10;
    if (circleRectOverlap(badge.x, badge.y, br, box, 1)) {
      score += 90;
      if (circleRectOverlap(badge.x, badge.y, br - 1, box, -1)) hardBlock = true;
    }
  }
  score += labelNearAnyLine(lx, ly, station.name, rotate, anchor, 4);
  score += Math.hypot(lx - station.x, ly - station.y) * 0.2;
  return { blocked: hardBlock, score };
}

/**
 * @param {Map<string, object>} meta
 * @param {Array<{ id: string, name: string, x: number, y: number }>} stations
 * @param {'classic' | 'orthogonal'} [layoutMode]
 */
function computeLabelLayouts(meta, stations, layoutMode = "classic") {
  const layouts = /* @__PURE__ */ new Map();
  const placedBoxes = [];
  const sorted = [...stations].sort((a, b) => {
    // orthogonal: 환승·종착 우선 → 밀집도
    const ta = meta.get(a.id)?.isTransfer ? 1 : 0;
    const tb = meta.get(b.id)?.isTransfer ? 1 : 0;
    if (layoutMode === "orthogonal") {
      if (tb !== ta) return tb - ta;
      const da = countNearbyStations(a, stations);
      const db = countNearbyStations(b, stations);
      if (db !== da) return db - da;
    } else {
      const da = countNearbyStations(a, stations);
      const db = countNearbyStations(b, stations);
      if (db !== da) return db - da;
      if (tb !== ta) return tb - ta;
    }
    if (a.name.length !== b.name.length) return b.name.length - a.name.length;
    return a.name.localeCompare(b.name, "ko");
  });
  for (const station of sorted) {
    const stationMeta = meta.get(station.id) ?? {
      isTransfer: false,
      lineColor: "#64748b",
      lineKeys: [],
      lineColors: [],
    };
    let best = null;
    let bestScore = Infinity;
    for (const cand of buildLayoutCandidates(station, stationMeta, layoutMode)) {
      const { blocked, score } = scoreLabelCandidate(
        station,
        stationMeta,
        cand.lx,
        cand.ly,
        cand.rotate,
        cand.anchor,
        placedBoxes,
        cand.fromSvg,
        stations,
        cand.orthoPenalty ?? 0,
      );
      if (!blocked && score < bestScore) {
        bestScore = score;
        best = {
          x: cand.lx,
          y: cand.ly,
          anchor: cand.anchor,
          rotate: cand.rotate,
        };
      }
    }
    if (!best) {
      if (layoutMode === "orthogonal") {
        best = {
          x: station.x + 11,
          y: station.y - 2,
          anchor: "start",
          rotate: 0,
        };
      } else {
        const svg = getSvgLabelDefault(station);
        best = {
          x: svg.x,
          y: svg.y,
          anchor: svg.anchor,
          rotate: svg.rotate,
        };
      }
    }
    layouts.set(station.id, best);
    placedBoxes.push(labelBox(best.x, best.y, station.name, best.rotate, best.anchor));
  }
  return layouts;
}

const LABEL_LAYOUT_CACHE = /* @__PURE__ */ new Map();

/**
 * 라벨 맵 (노드 좌표가 바뀌면 stations 기준으로 재계산)
 * @param {Map<string, object>} meta
 * @param {Array<{ id: string, name: string, x: number, y: number }>} stations
 * @param {'classic' | 'orthogonal'} layoutMode
 * @param {string} [cacheKey]
 */
export function getLabelLayoutsForStations(
  meta,
  stations,
  layoutMode = "classic",
  cacheKey = "",
) {
  const key =
    cacheKey ||
    `${layoutMode}:${stations.length}:${stations[0]?.x ?? 0}:${stations[0]?.y ?? 0}:${stations[stations.length - 1]?.x ?? 0}`;
  if (LABEL_LAYOUT_CACHE.has(key)) return LABEL_LAYOUT_CACHE.get(key);
  const layouts = computeLabelLayouts(meta, stations, layoutMode);
  LABEL_LAYOUT_CACHE.set(key, layouts);
  return layouts;
}
let STATION_META = /* @__PURE__ */ new Map();
let STATION_LABELS = /* @__PURE__ */ new Map();

export function initMetroMapLayout(meta, stations) {
  STATION_META = meta;
  STATION_LABELS = computeLabelLayouts(meta, stations);
}

function getStationMeta(station) {
  return STATION_META.get(station.id) ?? {
    isTransfer: false,
    lineColor: "#64748b",
    lineKeys: [],
    lineColors: []
  };
}
function getLabelLayout(stationId) {
  return STATION_LABELS.get(stationId) ?? LABEL_OVERRIDES[stationId] ?? {
    x: 0,
    y: 0,
    anchor: "start",
    rotate: -38
  };
}
export {
  BASE_STATION_R,
  STATION_LABELS,
  STATION_META,
  TRANSFER_STATION_R,
  computeAllStationMeta,
  computeLabelLayouts,
  getLabelLayout,
  getStationMarkerRadius,
  getStationMeta,
};
