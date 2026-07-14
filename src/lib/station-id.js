/** 역 선택 ID에서 기본 역명만 추출 (예: "연신내|3호선" → "연신내") */
import { resolveStationAlias } from "./station-merges";

export function baseStationId(stationId) {
  if (!stationId) return stationId;
  const raw = String(stationId).split("|")[0].replace(/역.*$/, "").trim();
  return resolveStationAlias(raw);
}

export function stationIdWithLine(baseName, lineKey) {
  return `${baseName.replace(/역.*$/, "").trim()}|${lineKey}`;
}

export function sameStation(a, b) {
  if (!a || !b) return false;
  return baseStationId(a) === baseStationId(b);
}
