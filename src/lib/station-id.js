/** 역 선택 ID에서 기본 역명만 추출 (예: "연신내|3호선" → "연신내") */
export function baseStationId(stationId) {
  if (!stationId) return stationId;
  return String(stationId).split("|")[0].replace(/역.*$/, "").trim();
}

export function stationIdWithLine(baseName, lineKey) {
  return `${baseName.replace(/역.*$/, "").trim()}|${lineKey}`;
}

export function sameStation(a, b) {
  if (!a || !b) return false;
  return baseStationId(a) === baseStationId(b);
}
