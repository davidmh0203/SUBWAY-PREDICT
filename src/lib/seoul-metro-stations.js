import { METRO_STATIONS } from "./metro-network";
import { getStationLineColor, getLineKeyForColor } from "./metro-network";
import { baseStationId } from "./station-id";

/** 서울 지하철 1~8호선만 지원 (9호선·신분당선 제외) */
const SEOUL_LINE_PATTERN = /^[1-8]호선/;
const EXCLUDED_LINE_KEYS = new Set(["9호선", "신분당선"]);

function isExcludedLine(lineKey) {
  return EXCLUDED_LINE_KEYS.has(lineKey);
}

function isSupportedSeoulLine(lineKey) {
  if (!lineKey || isExcludedLine(lineKey)) return false;
  return SEOUL_LINE_PATTERN.test(lineKey);
}

/** 역 검색·배지에 노출할 호선인지 (1~8호선만) */
function isSelectableLineKey(lineKey) {
  return isSupportedSeoulLine(lineKey);
}

const EXTRA_STATIONS = [
  "신도림", "구로디지털", "신림", "봉천", "사당", "방배", "서초", "강남",
  "잠실", "건대입구", "왕십리", "홍대입구", "을지로3가", "서울역", "종로3가",
  "가산디지털단지",
];

function buildSeoulStationSet() {
  const set = new Set(EXTRA_STATIONS);
  for (const station of METRO_STATIONS) {
    const lineKey = getLineKeyForColor(getStationLineColor(station.x, station.y));
    if (SEOUL_LINE_PATTERN.test(lineKey)) {
      set.add(station.name);
      set.add(station.id);
    }
  }
  return set;
}

let seoulStationIdsCache = null;

function getSeoulStationIds() {
  if (!seoulStationIdsCache) {
    seoulStationIdsCache = buildSeoulStationSet();
  }
  return seoulStationIdsCache;
}

function isSeoulMetroStation(stationIdOrName) {
  const clean = baseStationId(stationIdOrName);
  return getSeoulStationIds().has(clean);
}

export {
  EXCLUDED_LINE_KEYS,
  SEOUL_LINE_PATTERN,
  getSeoulStationIds,
  isExcludedLine,
  isSeoulMetroStation,
  isSelectableLineKey,
  isSupportedSeoulLine,
};
