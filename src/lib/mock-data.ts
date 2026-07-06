import type {
  CongestionPredictResponse,
  CongestionStatus,
  MacroPredictMap,
  RoutePath,
} from "./types";
import { getStatusFromRate } from "./congestion";

const BASE_PREDICTIONS = [
  { stationId: 234, stationName: "신도림", baseRate: 55 },
  { stationId: 230, stationName: "신림", baseRate: 85 },
  { stationId: 226, stationName: "사당", baseRate: 140, trigger: "KOPIS_EVENT" as const },
  { stationId: 222, stationName: "강남", baseRate: 60 },
];

function scaleRate(base: number, timeOffset: number, stationId: number): number {
  const peak = Math.max(0, 1 - Math.abs(timeOffset - 30) / 45);
  const eventBoost = stationId === 226 ? peak * 45 : 0;
  const commute = timeOffset >= 20 && timeOffset <= 50 ? 25 : 0;
  return Math.round(base + eventBoost + commute * (stationId === 226 ? 1.2 : 0.4));
}

export function getPredictionsForTime(targetTime: Date): CongestionPredictResponse {
  const minutes = targetTime.getHours() * 60 + targetTime.getMinutes();
  const baseMinutes = 18 * 60 + 30;
  const offset = minutes - baseMinutes;

  const predictions = BASE_PREDICTIONS.map((s) => {
    const congestionRate = scaleRate(s.baseRate, offset, s.stationId);
    return {
      stationId: s.stationId,
      stationName: s.stationName,
      congestionRate,
      status: getStatusFromRate(congestionRate),
      heading: "외선순환",
      arrivalTime: minutesToArrival(s.stationId, targetTime),
      ...(s.trigger && congestionRate >= 100 ? { trigger: s.trigger } : {}),
    };
  });

  return {
    targetDateTime: targetTime.toISOString(),
    externalFactors: {
      weather: { status: "RAINY", weight: 1.2 },
      event: {
        title: "잠실 주경기장 콘서트",
        location: "종합운동장역",
        scale: "LARGE",
        weight: 1.35,
      },
    },
    predictions,
  };
}

function minutesToArrival(stationId: number, start: Date): string {
  const offsets: Record<number, number> = { 234: 0, 230: 8, 226: 15, 222: 32 };
  const d = new Date(start.getTime() + (offsets[stationId] ?? 0) * 60_000);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function getMacroDataForTime(time: string): MacroPredictMap {
  const map: Record<string, MacroPredictMap> = {
    "17:30": {
      "line-2-west": "SMOOTH",
      "line-2-east": "WARNING",
      "line-4": "SMOOTH",
      "line-sinbundang": "SMOOTH",
      "station-sadang": "WARNING",
      "station-gangnam": "WARNING",
    },
    "18:00": {
      "line-2-west": "WARNING",
      "line-2-east": "DANGER",
      "line-4": "WARNING",
      "line-sinbundang": "WARNING",
      "station-sadang": "DANGER",
      "station-gangnam": "WARNING",
    },
    "18:30": {
      "line-2-west": "WARNING",
      "line-2-east": "DANGER",
      "line-4": "WARNING",
      "line-sinbundang": "DANGER",
      "station-sadang": "DANGER",
      "station-gangnam": "DANGER",
    },
    "19:00": {
      "line-2-west": "WARNING",
      "line-2-east": "WARNING",
      "line-4": "SMOOTH",
      "line-sinbundang": "WARNING",
      "station-sadang": "WARNING",
      "station-gangnam": "WARNING",
    },
    "19:30": {
      "line-2-west": "SMOOTH",
      "line-2-east": "WARNING",
      "line-4": "SMOOTH",
      "line-sinbundang": "WARNING",
      "station-sadang": "WARNING",
      "station-gangnam": "SMOOTH",
    },
  };
  return map[time] ?? map["18:30"];
}

export function getMacroDataFromDate(date: Date): MacroPredictMap {
  const h = date.getHours();
  const m = date.getMinutes();
  const rounded = `${String(h).padStart(2, "0")}:${m < 15 ? "00" : m < 45 ? "30" : "00"}`;
  const keys = ["17:30", "18:00", "18:30", "19:00", "19:30"];
  const closest = keys.reduce((prev, curr) => {
    const prevDiff = Math.abs(parseTime(prev) - (h * 60 + m));
    const currDiff = Math.abs(parseTime(curr) - (h * 60 + m));
    return currDiff < prevDiff ? curr : prev;
  });
  return getMacroDataForTime(closest || rounded);
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function getCongestionIndexForTime(targetTime: Date): number {
  const data = getPredictionsForTime(targetTime);
  return Math.round(
    data.predictions.reduce((sum, p) => sum + p.congestionRate, 0) / data.predictions.length,
  );
}

export function getChartData(): { time: string; index: number; status: CongestionStatus }[] {
  const slots = ["17:30", "17:45", "18:00", "18:15", "18:30", "18:45", "19:00", "19:10", "19:15", "19:30", "19:45", "20:00"];
  return slots.map((time) => {
    const [h, m] = time.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    const index = getCongestionIndexForTime(d);
    return { time, index, status: getStatusFromRate(index) };
  });
}

export function buildRoutes(targetTime: Date): RoutePath[] {
  const fastPredictions = getPredictionsForTime(targetTime);
  const maxFast = Math.max(...fastPredictions.predictions.map((p) => p.congestionRate));
  const fastStatus = getStatusFromRate(maxFast);

  const comfortTime = new Date(targetTime.getTime() + 7 * 60_000);
  const comfortPredictions = getPredictionsForTime(comfortTime).predictions.map((p) => ({
    ...p,
    congestionRate: Math.max(40, Math.round(p.congestionRate * 0.55)),
    status: getStatusFromRate(Math.max(40, Math.round(p.congestionRate * 0.55))),
  }));
  const maxComfort = Math.max(...comfortPredictions.map((p) => p.congestionRate));

  return [
    {
      id: "fast",
      label: "최단 시간 경로",
      badge: "시간 우선",
      totalTime: 32,
      payment: 1400,
      transfers: 0,
      lineName: "2호선",
      maxCongestion: maxFast,
      overallStatus: fastStatus,
      description: "신도림 ── 여유 ──> 신림 ── 주의 ──> 사당(🔴)",
      stations: ["신도림", "신림", "사당", "강남"],
      stationPredictions: fastPredictions.predictions,
    },
    {
      id: "comfort",
      label: "추천 쾌적 경로",
      badge: "쾌적 우선",
      totalTime: 39,
      payment: 1400,
      transfers: 1,
      lineName: "9호선 우회",
      maxCongestion: maxComfort,
      overallStatus: getStatusFromRate(maxComfort),
      description: "신길역 거쳐 9호선 우회 탑승 코스",
      stations: ["신도림", "신길", "당산", "강남"],
      stationPredictions: comfortPredictions,
      recommended: true,
    },
  ];
}

export const SLIDER_MARKS = ["17:30", "18:00", "18:30", "19:00", "19:30"];

export function sliderIndexToDate(index: number, baseDate: Date): Date {
  const time = SLIDER_MARKS[index] ?? "18:30";
  const [h, m] = time.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}

export function dateToSliderIndex(date: Date): number {
  const minutes = date.getHours() * 60 + date.getMinutes();
  let best = 2;
  let bestDiff = Infinity;
  SLIDER_MARKS.forEach((t, i) => {
    const [h, m] = t.split(":").map(Number);
    const diff = Math.abs(h * 60 + m - minutes);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  return best;
}
