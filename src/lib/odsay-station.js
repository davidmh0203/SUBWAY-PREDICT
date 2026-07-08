/** ODsay searchStation — 역명 검색·결과 구분 유틸 */

/** 수도권 서울 도시코드 (CID 필터용) */
export const ODSAY_SEOUL_CID = 1000;

/**
 * ODsay DB 역명은 "역" 접미사 없이 저장됨.
 * "강남역" → "강남" 으로 정규화해 searchStation에 전달.
 */
export function normalizeStationSearchQuery(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.replace(/역$/u, "");
}

/** laneName 예: "수도권 2호선" → "2호선" */
export function getStationLineLabel(laneName) {
  if (!laneName) return null;
  const match = laneName.match(/(\d+호선|신분당선|경의중앙선|공항철도|경춘선|수인분당선|수인\.분당선|에버라인|우이신설|김포골드|신림선|GTX-[A-Z]|서해선)/u);
  if (match) return match[1].replace("수인.분당선", "수인분당선");
  return laneName.replace(/^수도권\s*/u, "");
}

/** 역 한 줄 라벨 — 동명이역·유사명 구분 */
export function formatOdsayStationLabel(station) {
  const line = getStationLineLabel(station.laneName);
  const region = [station.gu, station.dong].filter(Boolean).join(" ");
  const parts = [station.stationName];
  if (line) parts.push(line);
  if (region) parts.push(region);
  return parts.join(" · ");
}

/** 역 고유 식별 — stationID는 노선별로 다름 */
export function getOdsayStationKey(station) {
  return `${station.CID}-${station.stationID}`;
}

function normalizedName(name) {
  return normalizeStationSearchQuery(name);
}

/** 검색어와 역명 일치도 (정확 > 접두 > 포함) */
export function scoreStationNameMatch(station, rawQuery) {
  const query = normalizedName(rawQuery);
  const name = station.stationName ?? "";
  if (!query) return 0;
  if (name === query) return 100;
  if (name.startsWith(query)) return 80;
  if (name.includes(query)) return 60;
  return 0;
}

/** 동명·유사명 결과 정렬 — 일치도 우선, 같으면 호선명 */
export function rankOdsayStations(stations, rawQuery) {
  return [...stations].sort((a, b) => {
    const scoreDiff = scoreStationNameMatch(b, rawQuery) - scoreStationNameMatch(a, rawQuery);
    if (scoreDiff !== 0) return scoreDiff;
    const lineA = a.laneName ?? "";
    const lineB = b.laneName ?? "";
    return lineA.localeCompare(lineB, "ko");
  });
}

/** 동일 역명 그룹 (환승역·노선별 중복) */
export function groupOdsayStationsByName(stations) {
  const groups = new Map();
  for (const station of stations) {
    const key = station.stationName;
    const list = groups.get(key) ?? [];
    list.push(station);
    groups.set(key, list);
  }
  return groups;
}
