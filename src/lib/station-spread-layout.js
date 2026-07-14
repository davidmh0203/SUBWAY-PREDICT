/**
 * 역 노드가 겹치지 않도록 표시 좌표를 살짝 벌립니다.
 * (환승역 큰 원 우선, 원본 좌표에서 최대 MAX_SHIFT만 이동)
 */
import { getRegistryLines } from "./station-line-registry.js";

const BASE_R = 4.5;
const TRANSFER_R = 4.5;
const PAD = 3.5;
const TRANSFER_PAIR_PAD = 1;
const MAX_SHIFT = 14;
const ENDPOINT_TOL = 8;

function colorToLineKey(color, lineColorLabels) {
  return lineColorLabels[color.toLowerCase()] ?? color.toLowerCase();
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

/** spread용 isTransfer 판별 (원본 좌표 기준) */
export function computeTransferFlags(stations, segments, lineColorLabels) {
  const map = new Map();
  for (const station of stations) {
    const registry = getRegistryLines(station.name);
    if (registry && registry.length >= 2) {
      map.set(station.id, true);
      continue;
    }
    const keys = new Set();
    for (const seg of segments) {
      const nearStart = Math.hypot(seg.x1 - station.x, seg.y1 - station.y) < ENDPOINT_TOL;
      const nearEnd = Math.hypot(seg.x2 - station.x, seg.y2 - station.y) < ENDPOINT_TOL;
      const onSegment =
        pointToSegmentDistance(station.x, station.y, seg) < (seg.width ?? 3) / 2 + 2;
      if (nearStart || nearEnd || onSegment) {
        keys.add(colorToLineKey(seg.color, lineColorLabels));
      }
    }
    map.set(station.id, keys.size >= 2);
  }
  return map;
}

function markerRadius(isTransfer) {
  return isTransfer ? TRANSFER_R : BASE_R;
}

function clampToOrigin(orig, x, y) {
  const dx = x - orig.x;
  const dy = y - orig.y;
  const d = Math.hypot(dx, dy);
  if (d <= MAX_SHIFT) return { x, y };
  const s = MAX_SHIFT / d;
  return { x: orig.x + dx * s, y: orig.y + dy * s };
}

export function applyStationSpread(stations, transferFlags) {
  const origins = new Map(stations.map((s) => [s.id, { x: s.x, y: s.y }]));
  const pos = new Map(stations.map((s) => [s.id, { x: s.x, y: s.y }]));

  const sorted = [...stations].sort((a, b) => {
    const ta = transferFlags.get(a.id) ? 1 : 0;
    const tb = transferFlags.get(b.id) ? 1 : 0;
    return tb - ta;
  });

  for (let iter = 0; iter < 30; iter++) {
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        const pa = pos.get(a.id);
        const pb = pos.get(b.id);
        const ra = markerRadius(transferFlags.get(a.id));
        const rb = markerRadius(transferFlags.get(b.id));
        const bothTransfer = transferFlags.get(a.id) && transferFlags.get(b.id);
        const minD = ra + rb + PAD + (bothTransfer ? TRANSFER_PAIR_PAD : 0);
        let dx = pb.x - pa.x;
        let dy = pb.y - pa.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.001) {
          dx = 1;
          dy = 0;
          dist = 1;
        }
        if (dist >= minD) continue;
        const push = (minD - dist) / 2 + 0.35;
        const ux = dx / dist;
        const uy = dy / dist;
        pos.set(
          a.id,
          clampToOrigin(origins.get(a.id), pa.x - ux * push, pa.y - uy * push),
        );
        pos.set(
          b.id,
          clampToOrigin(origins.get(b.id), pb.x + ux * push, pb.y + uy * push),
        );
      }
    }
  }

  return stations.map((s) => {
    const p = pos.get(s.id);
    return {
      ...s,
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
    };
  });
}
