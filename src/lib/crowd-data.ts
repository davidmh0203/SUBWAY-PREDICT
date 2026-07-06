import type { CarCongestionRow, CrowdLevel, HourlyCongestion, MapSegment } from "./types";
import { rateToCrowdLevel } from "./congestion";

const ROUTE_STATIONS = [
  { name: "신도림", baseRate: 48 },
  { name: "구로디지털", baseRate: 62 },
  { name: "신림", baseRate: 78 },
  { name: "봉천", baseRate: 88 },
  { name: "사당", baseRate: 132 },
  { name: "방배", baseRate: 95 },
  { name: "서초", baseRate: 82 },
  { name: "강남", baseRate: 68 },
];

const CAR_OFFSETS = [0, 4, 8, -3, 2, 10, 18, 14];

export function getHourlyCongestionData(activeHour?: number): HourlyCongestion[] {
  return Array.from({ length: 18 }, (_, i) => {
    const hour = i + 6;
    let rate = 28 + Math.sin((hour - 6) / 4) * 12;

    if (hour >= 7 && hour <= 9) rate = 52 + (hour === 8 ? 28 : 12);
    if (hour >= 11 && hour <= 14) rate = 38 + (hour === 12 ? 8 : 0);
    if (hour >= 17 && hour <= 20) {
      const peak = hour === 18 ? 1 : hour === 19 ? 0.92 : 0.7;
      rate = 68 + peak * 55;
    }
    if (hour >= 21) rate = 35 - (hour - 21) * 4;

    if (activeHour !== undefined && Math.abs(hour - activeHour) <= 0) {
      rate += 8;
    }

    const rounded = Math.round(rate);
    return { hour, rate: rounded, level: rateToCrowdLevel(rounded) };
  });
}

export function getCarCongestionRows(timeOffset = 0): CarCongestionRow[] {
  return ROUTE_STATIONS.map((station, idx) => {
    const peakBoost = idx >= 4 ? Math.max(0, 30 - Math.abs(timeOffset - 30) * 0.4) : 0;
    const overallRate = Math.round(station.baseRate + peakBoost + timeOffset * 0.15);
    const cars = CAR_OFFSETS.map((offset, carIdx) => {
      const carRate = overallRate + offset + (carIdx >= 5 ? 12 : 0);
      return rateToCrowdLevel(carRate);
    });
    return { stationName: station.name, cars, overallRate };
  });
}

/** 실제 노선도 이미지 위 혼잡도 오버레이 세그먼트 (viewBox 0 0 1200 850) */
export function getMapSegmentsForTime(time: string): MapSegment[] {
  const levels: Record<string, Record<string, CrowdLevel>> = {
    "17:30": {
      "line2-west": "NORMAL",
      "line2-south": "BUSY",
      "line2-east": "VERY_BUSY",
      "line4-sadang": "NORMAL",
    },
    "18:00": {
      "line2-west": "BUSY",
      "line2-south": "VERY_BUSY",
      "line2-east": "VERY_BUSY",
      "line4-sadang": "BUSY",
    },
    "18:30": {
      "line2-west": "BUSY",
      "line2-south": "VERY_BUSY",
      "line2-east": "VERY_BUSY",
      "line4-sadang": "VERY_BUSY",
    },
    "19:00": {
      "line2-west": "NORMAL",
      "line2-south": "BUSY",
      "line2-east": "BUSY",
      "line4-sadang": "NORMAL",
    },
    "19:30": {
      "line2-west": "RELAXED",
      "line2-south": "NORMAL",
      "line2-east": "NORMAL",
      "line4-sadang": "RELAXED",
    },
  };

  const current = levels[time] ?? levels["18:30"];

  return [
    {
      id: "line2-west",
      label: "2호선 신도림–사당",
      baseColor: "#00A84D",
      path: "M 72 465 L 155 500 L 230 545 L 310 595",
      level: current["line2-west"],
    },
    {
      id: "line2-south",
      label: "2호선 사당–강남",
      baseColor: "#00A84D",
      path: "M 310 595 L 390 575 L 470 530 L 550 490 L 620 465",
      level: current["line2-south"],
    },
    {
      id: "line2-east",
      label: "2호선 강남–잠실",
      baseColor: "#00A84D",
      path: "M 620 465 L 700 450 L 780 440 L 860 435 L 920 430",
      level: current["line2-east"],
    },
    {
      id: "line4-sadang",
      label: "4호선 사당 교차",
      baseColor: "#00A5DE",
      path: "M 310 595 L 310 480 L 310 360",
      level: current["line4-sadang"],
    },
  ];
}

export function getStationMarkers(): { name: string; x: number; y: number }[] {
  return [
    { name: "신도림", x: 72, y: 465 },
    { name: "사당", x: 310, y: 595 },
    { name: "강남", x: 620, y: 465 },
    { name: "잠실", x: 920, y: 430 },
  ];
}
