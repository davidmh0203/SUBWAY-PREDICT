/**
 * Figma import package generator for 여유로 prototype.
 * Run: npm run export-figma
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "figma-export");

const stations = JSON.parse(
  fs.readFileSync(path.join(root, "src/lib/generated/metro-stations.json"), "utf8"),
);
const segments = JSON.parse(
  fs.readFileSync(path.join(root, "src/lib/generated/metro-line-segments.json"), "utf8"),
);
const viewbox = JSON.parse(
  fs.readFileSync(path.join(root, "src/lib/generated/metro-viewbox.json"), "utf8"),
);

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
  "#c77539": "서해선",
};

const CROWD_COLORS = {
  RELAXED: "#3cb878",
  NORMAL: "#5b9bd5",
  BUSY: "#8b6cc1",
  VERY_BUSY: "#e06090",
};

const ENDPOINT_TOL = 8;
const BASE_R = 4.5;
const TRANSFER_R = BASE_R * 1.5;

function getLineKey(color) {
  return LINE_COLOR_LABELS[color.toLowerCase()] ?? color.toLowerCase();
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

function getNearestColor(station) {
  let best = Infinity;
  let color = "#0054a6";
  for (const seg of segments) {
    const d = pointToSegmentDistance(station.x, station.y, seg);
    if (d < best) {
      best = d;
      color = seg.color;
    }
  }
  return color;
}

function getStationMeta(station) {
  const endpointColors = new Set();
  for (const seg of segments) {
    const nearStart = Math.hypot(seg.x1 - station.x, seg.y1 - station.y) < ENDPOINT_TOL;
    const nearEnd = Math.hypot(seg.x2 - station.x, seg.y2 - station.y) < ENDPOINT_TOL;
    if (nearStart || nearEnd) endpointColors.add(seg.color.toLowerCase());
  }
  const colorByKey = new Map();
  for (const color of endpointColors) {
    const key = getLineKey(color);
    if (!colorByKey.has(key)) colorByKey.set(key, color);
  }
  const lineKeys = [...colorByKey.keys()].sort((a, b) => a.localeCompare(b, "ko"));
  return {
    isTransfer: lineKeys.length >= 2,
    lineColor: getNearestColor(station),
    lineKeys,
  };
}

function buildMetroMapSvg() {
  const { width, height } = viewbox;
  const lines = segments
    .map(
      (seg) =>
        `<line x1="${seg.x1}" y1="${seg.y1}" x2="${seg.x2}" y2="${seg.y2}" stroke="${seg.color}" stroke-width="${seg.width ?? 3}" stroke-linecap="round"/>`,
    )
    .join("\n    ");

  const stationNodes = stations
    .map((station) => {
      const meta = getStationMeta(station);
      if (meta.isTransfer) {
        return `<circle cx="${station.x}" cy="${station.y}" r="${TRANSFER_R}" fill="#ffffff" stroke="#1a1a1a" stroke-width="2.2"/>`;
      }
      return `<circle cx="${station.x}" cy="${station.y}" r="${BASE_R}" fill="#ffffff" stroke="${meta.lineColor}" stroke-width="2.2"/>`;
    })
    .join("\n    ");

  const labels = stations
    .map(
      (station) =>
        `<text x="${station.x + 10}" y="${station.y - 8}" font-size="4.8" font-family="system-ui, sans-serif" fill="#334155" stroke="#ffffff" stroke-width="2" paint-order="stroke">${station.name}</text>`,
    )
    .join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#fafbfc"/>
  <g id="lines">
    ${lines}
  </g>
  <g id="labels" opacity="0.9">
    ${labels}
  </g>
  <g id="stations">
    ${stationNodes}
  </g>
</svg>`;
}

function buildDesignTokens() {
  const lineColors = {};
  for (const [hex, name] of Object.entries(LINE_COLOR_LABELS)) {
    if (!lineColors[name]) lineColors[name] = hex;
  }

  return {
    name: "여유로",
    frame: { width: 390, height: 844, device: "iPhone 14" },
    colors: {
      background: "#ffffff",
      foreground: "#1e293b",
      muted: "#f1f5f9",
      mutedForeground: "#64748b",
      border: "#e2e8f0",
      destructive: "#e11d48",
      success: "#16a34a",
      mapBackground: "#fafbfc",
      transferStroke: "#1a1a1a",
      ...lineColors,
      crowd: CROWD_COLORS,
    },
    typography: {
      fontFamily: "Pretendard, Apple SD Gothic Neo, system-ui, sans-serif",
      sizes: {
        title: 24,
        body: 14,
        caption: 10,
        mapLabel: 4.8,
      },
    },
    radius: { sm: 4, md: 8, lg: 12, xl: 16 },
    shadows: {
      surface: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.05)",
      nav: "0 -1px 12px rgba(15,23,42,0.06)",
    },
    components: {
      stationRegular: { radius: BASE_R, fill: "#ffffff", stroke: "lineColor" },
      stationTransfer: { radius: TRANSFER_R, fill: "#ffffff", stroke: "#1a1a1a" },
    },
  };
}

function buildImportGuide() {
  return `# 여유로 → Figma 가져오기

이 폴더는 프로토타입을 Figma로 옮기기 위한 export 패키지입니다.

## 포함 파일

| 파일 | 설명 |
|------|------|
| \`screens/*.png\` | 4개 화면 스크린샷 (390×844) |
| \`metro-map.svg\` | 앱 스타일 노선도 벡터 |
| \`metro-map-source.svg\` | 원본 수도권 노선도 SVG |
| \`design-tokens.json\` | 색상·타이포·컴포넌트 스펙 |
| \`components/*.svg\` | 역 마커 컴포넌트 |

## 방법 1 — 스크린샷으로 빠르게 (추천)

1. Figma에서 **iPhone 14** 프레임(390×844) 생성
2. \`screens/\` PNG 4장을 프레임에 드래그
3. 화면별로 Frame 이름: \`01 홈\`, \`02 경로\`, \`03 상세\`, \`04 노선도\`

## 방법 2 — html.to.design 플러그인 (레이어 분리)

1. 터미널: \`npm run dev\`
2. Figma → Plugins → **html.to.design**
3. URL 입력:
   - \`http://localhost:5173/#home\`
   - \`http://localhost:5173/#results\`
   - \`http://localhost:5173/#detail\`
   - \`http://localhost:5173/#macro\`

## 방법 3 — 노선도만 벡터로

1. \`metro-map.svg\`를 Figma 캔버스에 드래그
2. 레이어: lines / labels / stations 분리 편집 가능

## 디자인 토큰 적용

\`design-tokens.json\`의 \`colors\`를 Figma **Color styles**로 등록하세요.

## 재생성

\`\`\`bash
npm run export-figma
\`\`\`
`;
}

function buildComponentSvgs(componentsDir) {
  const regular = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="${BASE_R}" fill="#ffffff" stroke="#00a44a" stroke-width="2.2"/>
</svg>`;

  const transfer = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="${TRANSFER_R}" fill="#ffffff" stroke="#1a1a1a" stroke-width="2.2"/>
</svg>`;

  fs.writeFileSync(path.join(componentsDir, "station-regular.svg"), regular);
  fs.writeFileSync(path.join(componentsDir, "station-transfer.svg"), transfer);
}

// --- main ---
fs.mkdirSync(path.join(outDir, "screens"), { recursive: true });
fs.mkdirSync(path.join(outDir, "components"), { recursive: true });

fs.writeFileSync(path.join(outDir, "metro-map.svg"), buildMetroMapSvg());
fs.copyFileSync(
  path.join(root, "public/capital-metro-map.svg"),
  path.join(outDir, "metro-map-source.svg"),
);
fs.writeFileSync(
  path.join(outDir, "design-tokens.json"),
  JSON.stringify(buildDesignTokens(), null, 2),
);
fs.writeFileSync(path.join(outDir, "FIGMA_IMPORT.md"), buildImportGuide());
buildComponentSvgs(path.join(outDir, "components"));

console.log("Figma export package written to:", outDir);
console.log("Next: npm run export-figma:screens (dev server required)");
