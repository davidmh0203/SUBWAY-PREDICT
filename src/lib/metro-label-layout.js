import {
  METRO_LINE_SEGMENTS,
  METRO_STATIONS,
  getLineKeyForColor,
  getNearestSegmentColor,
  normalizeLineColor,
} from "./metro-network";
import { LINE_END_BADGES } from "./metro-line-badges";
import { getRegistryLines } from "./station-line-registry";
import { colorForLineKey } from "./station-line-colors";
const BASE_STATION_R = 4.5;
const TRANSFER_STATION_R = BASE_STATION_R * 1.5;
const ENDPOINT_TOL = 8;
const LABEL_OVERRIDES = {
  김포공항: { x: 378, y: 472, anchor: "end", rotate: -38 },
  공항시장: { x: 432, y: 454, anchor: "start", rotate: -38 },
  마곡나루: { x: 484, y: 448, anchor: "start", rotate: -38 },
  신방화: { x: 460, y: 442, anchor: "end", rotate: -38 },
  개화산: { x: 412, y: 418, anchor: "end", rotate: -38 },
  송정: { x: 452, y: 462, anchor: "start", rotate: -38 },
  마곡: { x: 484, y: 456, anchor: "start", rotate: -38 },
  방화: { x: 438, y: 432, anchor: "start", rotate: -38 }
};
function colorToLineKey(color) {
  return getLineKeyForColor(color);
}
function getStationMarkerRadius(meta) {
  return meta.isTransfer ? TRANSFER_STATION_R : BASE_STATION_R;
}
function markerOverlap(cx, cy, meta, box, pad) {
  return circleRectOverlap(cx, cy, getStationMarkerRadius(meta), box, pad);
}
function computeAllStationMeta() {
  const map = /* @__PURE__ */ new Map();
  for (const station of METRO_STATIONS) {
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

    const isTransfer = lineKeys.length >= 2;
    const lineColor = getNearestSegmentColor(station.x, station.y).toLowerCase();
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
  const dists = [11, 14, 17, 21, 25];
  for (let deg = 0; deg < 360; deg += 22.5) {
    const rad = deg * Math.PI / 180;
    for (const dist of dists) {
      const ox = Math.cos(rad) * dist;
      const oy = Math.sin(rad) * dist;
      out.push({
        x: 0,
        y: 0,
        ox,
        oy,
        anchor: ox > 4 ? "start" : ox < -4 ? "end" : "middle",
        rotate: -38
      });
    }
  }
  return out;
})();
function computeLabelLayouts(meta) {
  const layouts = /* @__PURE__ */ new Map();
  const placedBoxes = [];
  const sorted = [...METRO_STATIONS].sort((a, b) => {
    const ta = meta.get(a.id)?.isTransfer ? 1 : 0;
    const tb = meta.get(b.id)?.isTransfer ? 1 : 0;
    if (tb !== ta) return tb - ta;
    if (a.name.length !== b.name.length) return b.name.length - a.name.length;
    return a.name.localeCompare(b.name, "ko");
  });
  for (const station of sorted) {
    const override = LABEL_OVERRIDES[station.id];
    if (override) {
      layouts.set(station.id, override);
      placedBoxes.push(
        labelBox(override.x, override.y, station.name, override.rotate, override.anchor)
      );
      continue;
    }
    const m = meta.get(station.id);
    const stationMeta = m ?? {
      isTransfer: false,
      lineColor: "#64748b",
      lineKeys: [],
      lineColors: []
    };
    let best = null;
    let bestScore = Infinity;
    for (const cand of CANDIDATES) {
      const scale = 1 + (stationMeta.isTransfer ? 0.25 : 0);
      const lx = station.x + cand.ox * scale;
      const ly = station.y + cand.oy * scale;
      const box = labelBox(lx, ly, station.name, cand.rotate, cand.anchor);
      let score = 0;
      let hardBlock = false;
      if (markerOverlap(station.x, station.y, stationMeta, box, 3)) {
        hardBlock = true;
      }
      for (const other of METRO_STATIONS) {
        if (other.id === station.id) continue;
        const otherMeta = meta.get(other.id) ?? {
          isTransfer: false,
          lineColor: "#64748b",
          lineKeys: [],
          lineColors: []
        };
        if (markerOverlap(other.x, other.y, otherMeta, box, 2)) {
          score += 120;
          if (markerOverlap(other.x, other.y, otherMeta, box, 0)) hardBlock = true;
        }
      }
      for (const pb of placedBoxes) {
        if (boxesOverlap(box, pb, 2)) {
          score += 150;
          if (boxesOverlap(box, pb, 0)) hardBlock = true;
        }
      }
      for (const badge of LINE_END_BADGES) {
        const br = badge.label.length <= 2 ? 8 : 10;
        if (circleRectOverlap(badge.x, badge.y, br, box, 2)) {
          score += 100;
          if (circleRectOverlap(badge.x, badge.y, br - 1, box, 0)) hardBlock = true;
        }
      }
      score += labelNearAnyLine(lx, ly, station.name, cand.rotate, cand.anchor, 5);
      score += Math.hypot(cand.ox, cand.oy) * 0.15;
      if (!hardBlock && score < bestScore) {
        bestScore = score;
        best = { x: lx, y: ly, anchor: cand.anchor, rotate: cand.rotate };
      }
    }
    if (!best) {
      best = {
        x: station.x + 14,
        y: station.y - 12,
        anchor: "start",
        rotate: -38
      };
    }
    layouts.set(station.id, best);
    placedBoxes.push(labelBox(best.x, best.y, station.name, best.rotate, best.anchor));
  }
  return layouts;
}
const STATION_META = computeAllStationMeta();
const STATION_LABELS = computeLabelLayouts(STATION_META);
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
  getStationMeta
};
