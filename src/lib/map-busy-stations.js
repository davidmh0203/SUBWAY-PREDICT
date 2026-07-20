import { CROWD_COLORS } from "@/lib/congestion";
import { stripStationSuffix } from "@/lib/station-name";

/** 보통(NORMAL) 초과 — 혼잡 / 매우혼잡 / 극혼잡 */
export const BUSY_ABOVE_NORMAL = new Set(["BUSY", "VERY_BUSY", "EXTREME"]);

/**
 * 노선도 시안용 데모 혼잡 (보통 초과만).
 * 실제 API 연동 전 비교 UI용 — 출퇴근 피크 역 위주.
 */
const DEMO_BUSY_BY_NAME = {
  강남: "VERY_BUSY",
  역삼: "BUSY",
  선릉: "BUSY",
  삼성: "BUSY",
  잠실: "VERY_BUSY",
  잠실새내: "BUSY",
  홍대입구: "VERY_BUSY",
  합정: "BUSY",
  신촌: "BUSY",
  이대: "BUSY",
  신도림: "VERY_BUSY",
  구로디지털단지: "BUSY",
  신림: "BUSY",
  사당: "EXTREME",
  교대: "BUSY",
  서울: "BUSY",
  시청: "BUSY",
  종각: "VERY_BUSY",
  종로3가: "BUSY",
  동대문: "BUSY",
  을지로입구: "BUSY",
  을지로3가: "BUSY",
  왕십리: "BUSY",
  건대입구: "VERY_BUSY",
  성수: "BUSY",
  고속터미널: "VERY_BUSY",
  노량진: "BUSY",
  여의도: "BUSY",
  공덕: "BUSY",
  충무로: "BUSY",
  동대문역사문화공원: "BUSY",
  약수: "BUSY",
  혜화: "BUSY",
  성신여대입구: "BUSY",
  수유: "BUSY",
  연신내: "BUSY",
  불광: "BUSY",
  김포공항: "BUSY",
  디지털미디어시티: "BUSY",
  당산: "BUSY",
  영등포구청: "BUSY",
  영등포: "BUSY",
  신논현: "BUSY",
  논현: "BUSY",
  신사: "BUSY",
  압구정: "BUSY",
  청담: "BUSY",
  뚝섬: "BUSY",
};

/**
 * @param {{ name?: string, id?: string }} station
 * @returns {'BUSY'|'VERY_BUSY'|'EXTREME'|null}
 */
export function getDemoBusyStationLevel(station) {
  const key = stripStationSuffix(station?.name ?? station?.id ?? "");
  const level = DEMO_BUSY_BY_NAME[key];
  return BUSY_ABOVE_NORMAL.has(level) ? level : null;
}

export function busyLevelColor(level) {
  return level && CROWD_COLORS[level] ? CROWD_COLORS[level] : null;
}

/**
 * @typedef {'off' | 'nodes' | 'labelBg' | 'rings' | 'halo' | 'busyLabels'} BusyHighlightMode
 */
