import type { CrowdLevel } from "./types";
import stationsJson from "./generated/metro-stations.json";
import segmentsJson from "./generated/metro-line-segments.json";
import viewboxJson from "./generated/metro-viewbox.json";

export interface MetroStation {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface MetroLineSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

export const METRO_STATIONS: MetroStation[] = stationsJson as MetroStation[];
export const METRO_LINE_SEGMENTS: MetroLineSegment[] = segmentsJson as MetroLineSegment[];
export const MAP_VIEWBOX = viewboxJson as { width: number; height: number };

const stationById = new Map(METRO_STATIONS.map((s) => [s.id, s]));
const stationByName = new Map(METRO_STATIONS.map((s) => [s.name, s]));

export function getStation(id: string): MetroStation | undefined {
  return stationById.get(id) ?? stationByName.get(id.replace(/역$/, ""));
}

export function getStationByName(name: string): MetroStation | undefined {
  const clean = name.replace(/역.*$/, "").trim();
  return stationByName.get(clean);
}

/** 호선 색상 → 명칭 (수도권 전철) */
export const LINE_COLOR_LABELS: Record<string, string> = {
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
  "#c77539": "서해선",
};

export function getLineKeyForColor(color: string): string {
  return LINE_COLOR_LABELS[color.toLowerCase()] ?? color.toLowerCase();
}

export function segmentMatchesLine(seg: MetroLineSegment, lineKey: string | null): boolean {
  if (!lineKey) return true;
  return getLineKeyForColor(seg.color) === lineKey;
}

/** 비포커스 노선 — 원색을 흰색과 섞어 옅게 표시 */
export function washLineColor(hex: string, whiteMix = 0.82): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return "#e8eaed";
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * whiteMix);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function getUniqueLineLegend(): { lineKey: string; color: string; name: string }[] {
  const byKey = new Map<string, string>();
  for (const seg of METRO_LINE_SEGMENTS) {
    const key = getLineKeyForColor(seg.color);
    if (!byKey.has(key)) byKey.set(key, seg.color);
  }
  return [...byKey.entries()]
    .map(([lineKey, color]) => ({ lineKey, color, name: lineKey }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function pointToSegmentDistance(
  px: number,
  py: number,
  seg: MetroLineSegment,
): number {
  const { x1, y1, x2, y2 } = seg;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function getNearestSegmentColor(x: number, y: number): string {
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

export function getStationLineColor(x: number, y: number): string {
  return getNearestSegmentColor(x, y);
}

/** 2호선 핵심 구간 혼잡도 오버레이 */
export function getSegmentCrowdLevel(seg: MetroLineSegment, time: string): CrowdLevel | null {
  if (seg.color.toLowerCase() !== "#00a44a") return null;
  const mx = (seg.x1 + seg.x2) / 2;
  const my = (seg.y1 + seg.y2) / 2;
  if (mx < 560 || mx > 1000 || my < 530 || my > 680) return null;

  const levels: Record<string, CrowdLevel> = {
    "17:30": "BUSY",
    "18:00": "VERY_BUSY",
    "18:30": "VERY_BUSY",
    "19:00": "BUSY",
    "19:30": "NORMAL",
  };
  return levels[time] ?? null;
}
