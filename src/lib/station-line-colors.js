/**
 * 수도권 전철 노선 상징색 (위키백과/서울시 노선도 가이드 기준)
 * @see https://ko.wikipedia.org/wiki/위키프로젝트:철도/지하철
 *
 * extract 결과는 공식색(#00A84D 등)으로 저장되고, SVG 원본은 다른 HEX(#00a44a 등)를
 * 쓸 수 있다. seoulOnly 필터는 키가 `1호선` 형태일 때만 통과하므로
 * 공식색 → 호선키 매핑이 빠지면 6호선(#CD7C2F, SVG와 동일)만 남는 버그가 난다.
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

const SEOUL_NUMERIC_LINE = /^[1-9]호선$/;

/** 같은 HEX에 키가 여러 개일 때 seoulOnly에 유리한 `N호선`을 우선 */
function preferLineKey(existing, next) {
  if (!existing) return next;
  if (!next) return existing;
  const existingSeoul = SEOUL_NUMERIC_LINE.test(existing);
  const nextSeoul = SEOUL_NUMERIC_LINE.test(next);
  if (nextSeoul && !existingSeoul) return next;
  if (existingSeoul && !nextSeoul) return existing;
  return existing;
}

/**
 * SVG 원본 HEX + 공식 상징색 HEX → 호선 키
 * (공식색만 있고 SVG 맵에 없으면 예전엔 seoulOnly에서 거의 전부 탈락함)
 */
export const HEX_TO_LINE_KEY = (() => {
  const map = {};
  for (const [lineKey, color] of Object.entries(LINE_KEY_COLORS)) {
    const hex = color.toLowerCase();
    map[hex] = preferLineKey(map[hex], lineKey);
  }
  for (const [hex, lineKey] of Object.entries(SVG_HEX_TO_LINE_KEY)) {
    const key = hex.toLowerCase();
    map[key] = preferLineKey(map[key], lineKey);
  }
  return map;
})();

export function lineKeyForSvgHex(hex) {
  if (!hex) return null;
  return HEX_TO_LINE_KEY[hex.toLowerCase()] ?? null;
}

export function colorForLineKey(lineKey) {
  if (!lineKey) return "#64748b";
  return LINE_KEY_COLORS[lineKey] ?? "#64748b";
}

/** SVG/레거시 HEX → 공식 상징색 */
export function officialColorForSvgHex(hex) {
  if (!hex) return hex;
  const lineKey = lineKeyForSvgHex(hex);
  if (lineKey) return colorForLineKey(lineKey);
  return hex.toLowerCase();
}
