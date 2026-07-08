/**
 * Extracts station coordinates from capital-metro-map.svg (MIT, Sinseiki)
 * Run: node scripts/extract-metro-data.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { officialColorForSvgHex } from "../src/lib/station-line-colors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgPath = path.join(root, "public/capital-metro-map.svg");
const svg = fs.readFileSync(svgPath, "utf8");

function parseTranslate(transform) {
  const m = transform.match(/translate\(([\d.]+)\s+([\d.]+)\)/);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

function slugify(name) {
  return name
    .replace(/\s+/g, "")
    .replace(/[()]/g, "")
    .replace(/[^a-zA-Z0-9가-힣]/g, "")
    .slice(0, 40);
}

// Station name labels (cls-40)
const textRegex = /<text class="cls-40" transform="([^"]+)"><tspan[^>]*>([^<]+)<\/tspan>/g;
const labels = [];
let match;
while ((match = textRegex.exec(svg)) !== null) {
  const pos = parseTranslate(match[1]);
  const name = match[2].trim();
  if (!pos || !name || name.length < 2) continue;
  if (/^\d/.test(name)) continue;
  labels.push({ name, x: pos.x, y: pos.y });
}

// All station circles
const circleRegex = /<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"[^>]*r="([\d.]+)"/g;
const circles = [];
while ((match = circleRegex.exec(svg)) !== null) {
  circles.push({
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
    r: parseFloat(match[3]),
  });
}

function nearestCircle(tx, ty) {
  let best = null;
  let bestDist = Infinity;
  for (const c of circles) {
    const d = Math.hypot(c.x - tx, c.y - ty);
    if (d < bestDist && d < 35) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

const stationMap = new Map();
for (const label of labels) {
  const circle = nearestCircle(label.x, label.y);
  if (!circle) continue;
  const key = label.name;
  if (!stationMap.has(key)) {
    stationMap.set(key, {
      id: slugify(label.name),
      name: label.name,
      x: Math.round(circle.x * 100) / 100,
      y: Math.round(circle.y * 100) / 100,
    });
  }
}

const stations = Array.from(stationMap.values()).sort((a, b) =>
  a.name.localeCompare(b.name, "ko"),
);

// Line segments from <line> elements
const lineClassColors = {};
const styleBlock = svg.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
for (const m of styleBlock.matchAll(/\.(cls-\d+)[^{]*\{[^}]*stroke:\s*(#[0-9a-fA-F]{3,8})/g)) {
  lineClassColors[m[1]] = m[2];
}
for (const m of styleBlock.matchAll(/\.(cls-\d+),\s*\.(cls-\d+)[^{]*\{[^}]*stroke:\s*(#[0-9a-fA-F]{3,8})/g)) {
  lineClassColors[m[1]] = m[3];
  lineClassColors[m[2]] = m[3];
}

const lineClassStrokes = {};
for (const m of styleBlock.matchAll(/\.(cls-\d+)[^{]*\{[^}]*stroke-width:\s*([\d.]+)px/g)) {
  lineClassStrokes[m[1]] = parseFloat(m[2]);
}
for (const m of styleBlock.matchAll(/\.(cls-\d+),\s*\.(cls-\d+)[^{]*\{[^}]*stroke-width:\s*([\d.]+)px/g)) {
  lineClassStrokes[m[1]] = parseFloat(m[3]);
  lineClassStrokes[m[2]] = parseFloat(m[3]);
}

const lineRegex = /<line class="(cls-\d+)" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g;
function normalizeExtractedColor(color) {
  return officialColorForSvgHex(color);
}
const segments = [];
let segIdx = 0;
while ((match = lineRegex.exec(svg)) !== null) {
  const cls = match[1];
  const color = normalizeExtractedColor(lineClassColors[cls] ?? "#94a3b8");
  const width = lineClassStrokes[cls] ?? 3;
  segments.push({
    id: `seg-${segIdx++}`,
    x1: parseFloat(match[2]),
    y1: parseFloat(match[3]),
    x2: parseFloat(match[4]),
    y2: parseFloat(match[5]),
    color,
    width,
  });
}

// Map background lines only SVG (strip circles, text, legend numbers)
let linesSvg = svg
  .replace(/<circle[\s\S]*?\/>/g, "")
  .replace(/<text[\s\S]*?<\/text>/g, "")
  .replace(/<tspan[\s\S]*?<\/tspan>/g, "");

// Remove legend / numbering clutter at bottom (y > 250 small cls-10 texts already removed)
// Keep han river polygons if any

const outDir = path.join(root, "src/lib/generated");
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, "metro-stations.json"),
  JSON.stringify(stations, null, 0),
);
fs.writeFileSync(
  path.join(outDir, "metro-line-segments.json"),
  JSON.stringify(segments, null, 0),
);
fs.writeFileSync(
  path.join(outDir, "metro-viewbox.json"),
  JSON.stringify({ width: 1150.36, height: 1074.59 }),
);

// Save lines-only inner content for embedding
const innerMatch = linesSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
if (innerMatch) {
  fs.writeFileSync(path.join(outDir, "metro-lines-inner.svg"), innerMatch[1]);
}

console.log(`Stations: ${stations.length}`);
console.log(`Line segments: ${segments.length}`);
console.log(`Sample:`, stations.filter((s) => ["신도림", "강남", "사당", "잠실"].includes(s.name)));
