import { METRO_STATIONS } from "@/lib/metro-network";
import { getStationMeta } from "@/lib/metro-label-layout";
import { normalizeStationSearchQuery } from "@/lib/odsay-station";
import { colorForLineKey } from "@/lib/station-line-colors";
import { isSupportedSeoulLine } from "@/lib/seoul-metro-stations";
import { sameStation, stationIdWithLine } from "@/lib/station-id";

function scoreMatch(name, query) {
  if (!query) return 0;
  if (name === query) return 100;
  if (name.startsWith(query)) return 80;
  if (name.includes(query)) return 60;
  return 0;
}

function expandLineVariants(station, meta) {
  if (meta.lineKeys.length <= 1) {
    return [
      {
        id: station.id,
        name: station.name,
        lineKeys: meta.lineKeys,
        lineColors: meta.lineColors,
      },
    ];
  }

  return meta.lineKeys
    .filter((lineKey) => isSupportedSeoulLine(lineKey))
    .map((lineKey) => ({
      id: stationIdWithLine(station.id, lineKey),
      name: station.name,
      lineKeys: [lineKey],
      lineColors: [meta.lineColors[meta.lineKeys.indexOf(lineKey)] ?? colorForLineKey(lineKey)],
      primaryLine: lineKey,
    }));
}

/**
 * 로컬 노선도 + 역별 호선 레지스트리 기반 역 추천 (ODsay API 미사용)
 * 환승역은 호선별로 분리해 표시합니다.
 */
export function searchLocalStations(rawQuery, options = {}) {
  const { limit = 8, excludeId = null } = options;
  const query = normalizeStationSearchQuery(rawQuery);

  if (query.length < 2) return [];

  const scored = [];
  for (const station of METRO_STATIONS) {
    const s = scoreMatch(station.name, query);
    if (s === 0) continue;
    const meta = getStationMeta(station);
    const variants = expandLineVariants(station, meta).filter(
      (variant) =>
        variant.lineKeys.length === 0 ||
        variant.lineKeys.some((lineKey) => isSupportedSeoulLine(lineKey)),
    );
    if (variants.length === 0) continue;
    for (const variant of variants) {
      if (excludeId && sameStation(variant.id, excludeId)) continue;
      scored.push({ ...variant, score: s });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return (
      a.name.localeCompare(b.name, "ko") ||
      (a.primaryLine ?? "").localeCompare(b.primaryLine ?? "", "ko")
    );
  });

  return scored.slice(0, limit).map(({ id, name, lineKeys, lineColors, primaryLine }) => ({
    id,
    name,
    lineKeys,
    lineColors,
    primaryLine,
  }));
}
