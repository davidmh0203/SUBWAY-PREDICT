import { METRO_STATIONS } from "./metro-network";
import { getStationLineColor, getLineKeyForColor } from "./metro-network";
import { baseStationId } from "./station-id";

const SEOUL_LINE_PATTERN = /^[1-9]호선/;

const EXTRA_STATIONS = [
  "신도림", "구로디지털", "신림", "봉천", "사당", "방배", "서초", "강남",
  "잠실", "건대입구", "왕십리", "홍대입구", "을지로3가", "서울역", "종로3가",
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

const SEOUL_STATION_IDS = buildSeoulStationSet();

function isSeoulMetroStation(stationIdOrName) {
  const clean = baseStationId(stationIdOrName);
  return SEOUL_STATION_IDS.has(clean);
}

export { SEOUL_STATION_IDS, isSeoulMetroStation };
