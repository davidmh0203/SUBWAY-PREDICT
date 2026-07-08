/**
 * 수도권 전철 노선 상징색 (위키백과/서울시 노선도 가이드 기준)
 * @see https://ko.wikipedia.org/wiki/위키프로젝트:철도/지하철
 */

export const LINE_KEY_COLORS = {
  "1호선": "#0052A4",
  "2호선": "#00A84D",
  "2호선(성수지선)": "#00A84D",
  "3호선": "#EF7C1C",
  "4호선": "#00A5DE",
  "5호선": "#996CAC",
  "6호선": "#CD7C2F",
  "7호선": "#747F00",
  "8호선": "#E6186C",
  "9호선": "#BDB092",
  신분당선: "#D4003B",
  경의중앙: "#77C4A3",
  경의선: "#77C4A3",
  경춘선: "#178C72",
  공항철도: "#0090D2",
  인천공항: "#0090D2",
  경강선: "#27977A",
  우이신설: "#B0CE18",
  인천1: "#7CA8D5",
  인천2: "#54668C",
  김포골드: "#AD8605",
  수인분당: "#F5A200",
  분당선: "#F5A200",
  서해선: "#CE3245",
  "GTX-A": "#0B456E",
};

/** 노선도 SVG 추출 HEX → 호선 키 */
export const SVG_HEX_TO_LINE_KEY = {
  "#0054a6": "1호선",
  "#005daa": "1호선",
  "#00a44a": "2호선",
  "#8fc31e": "2호선(성수지선)",
  "#f47d30": "3호선",
  "#00a9dc": "4호선",
  "#936fb1": "5호선",
  "#fda600": "5호선",
  "#ed8000": "6호선",
  "#cd7c2f": "6호선",
  "#677718": "7호선",
  "#ea545d": "8호선",
  "#c6b182": "9호선",
  "#9a6292": "신분당선",
  "#d31145": "경의중앙",
  "#b0ce18": "경의선",
  "#178c72": "경춘선",
  "#6789ca": "공항철도",
  "#a4dcff": "인천공항",
  "#76c4a3": "경강선",
  "#4ea346": "우이신설",
  "#6fa0ce": "인천1",
  "#3681b7": "인천2",
  "#ad8605": "김포골드",
  "#f99d1c": "수인분당",
  "#c77539": "서해선",
};

export function lineKeyForSvgHex(hex) {
  if (!hex) return null;
  const normalized = hex.toLowerCase();
  const mapped = SVG_HEX_TO_LINE_KEY[normalized];
  if (mapped) return mapped;

  // Fallback: 이미 공식색으로 정규화된 HEX도 호선 키로 역매핑
  for (const [lineKey, lineColor] of Object.entries(LINE_KEY_COLORS)) {
    if (lineColor.toLowerCase() === normalized) return lineKey;
  }
  return null;
}

export function colorForLineKey(lineKey) {
  if (!lineKey) return "#64748b";
  return LINE_KEY_COLORS[lineKey] ?? "#64748b";
}

/** SVG/레거시 HEX → 공식 상징색 */
export function officialColorForSvgHex(hex) {
  if (!hex) return hex;
  const lineKey = SVG_HEX_TO_LINE_KEY[hex.toLowerCase()];
  if (lineKey) return colorForLineKey(lineKey);
  return hex.toLowerCase();
}
