import { getStatusFromRate } from "./congestion";
import { findRouteVariants } from "./route-finder";
import { adaptApiRouteResponse } from "./api/route-adapter";
import { estimateLocalRouteMinutes, estimateSubwayPayment } from "./route-timing";
const BASE_PREDICTIONS = [
  { stationId: 234, stationName: "신도림", baseRate: 55 },
  { stationId: 230, stationName: "신림", baseRate: 85 },
  { stationId: 226, stationName: "사당", baseRate: 140, trigger: "KOPIS_EVENT" },
  { stationId: 222, stationName: "강남", baseRate: 60 }
];
function scaleRate(base, timeOffset, stationId) {
  const peak = Math.max(0, 1 - Math.abs(timeOffset - 30) / 45);
  const eventBoost = stationId === 226 ? peak * 45 : 0;
  const commute = timeOffset >= 20 && timeOffset <= 50 ? 25 : 0;
  return Math.round(base + eventBoost + commute * (stationId === 226 ? 1.2 : 0.4));
}
function getPredictionsForTime(targetTime) {
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
      ...s.trigger && congestionRate >= 100 ? { trigger: s.trigger } : {}
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
        weight: 1.35
      }
    },
    predictions
  };
}
function minutesToArrival(stationId, start) {
  const offsets = { 234: 0, 230: 8, 226: 15, 222: 32 };
  const d = new Date(start.getTime() + (offsets[stationId] ?? 0) * 6e4);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function getMacroDataForTime(time) {
  const map = {
    "17:30": {
      "line-2-west": "SMOOTH",
      "line-2-east": "WARNING",
      "line-4": "SMOOTH",
      "line-sinbundang": "SMOOTH",
      "station-sadang": "WARNING",
      "station-gangnam": "WARNING"
    },
    "18:00": {
      "line-2-west": "WARNING",
      "line-2-east": "DANGER",
      "line-4": "WARNING",
      "line-sinbundang": "WARNING",
      "station-sadang": "DANGER",
      "station-gangnam": "WARNING"
    },
    "18:30": {
      "line-2-west": "WARNING",
      "line-2-east": "DANGER",
      "line-4": "WARNING",
      "line-sinbundang": "DANGER",
      "station-sadang": "DANGER",
      "station-gangnam": "DANGER"
    },
    "19:00": {
      "line-2-west": "WARNING",
      "line-2-east": "WARNING",
      "line-4": "SMOOTH",
      "line-sinbundang": "WARNING",
      "station-sadang": "WARNING",
      "station-gangnam": "WARNING"
    },
    "19:30": {
      "line-2-west": "SMOOTH",
      "line-2-east": "WARNING",
      "line-4": "SMOOTH",
      "line-sinbundang": "WARNING",
      "station-sadang": "WARNING",
      "station-gangnam": "SMOOTH"
    }
  };
  return map[time] ?? map["18:30"];
}
function getMacroDataFromDate(date) {
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
function parseTime(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function getCongestionIndexForTime(targetTime) {
  const data = getPredictionsForTime(targetTime);
  return Math.round(
    data.predictions.reduce((sum, p) => sum + p.congestionRate, 0) / data.predictions.length
  );
}
function getChartData() {
  const slots = ["17:30", "17:45", "18:00", "18:15", "18:30", "18:45", "19:00", "19:10", "19:15", "19:30", "19:45", "20:00"];
  return slots.map((time) => {
    const [h, m] = time.split(":").map(Number);
    const d = /* @__PURE__ */ new Date();
    d.setHours(h, m, 0, 0);
    const index = getCongestionIndexForTime(d);
    return { time, index, status: getStatusFromRate(index) };
  });
}
function congestionLevel(value) {
  if (value <= 40) return "여유";
  if (value <= 65) return "보통";
  if (value <= 80) return "주의";
  return "혼잡";
}

function finderToRouteResponse(found, departure, destination) {
  const stations = [];
  found.segments.forEach((seg, segIdx) => {
    seg.stations.forEach((st) => {
      const isTransfer = st.type === "transfer";
      if (stations.length && stations[stations.length - 1].name === st.name) {
        stations[stations.length - 1].is_transfer = true;
        stations[stations.length - 1].line = seg.lineName;
        if (st.arrival_offset_min != null) {
          stations[stations.length - 1].arrival_offset_min = st.arrival_offset_min;
        }
        return;
      }
      stations.push({
        station_id: st.name,
        name: st.name,
        line: seg.lineName,
        station_congestion: Math.round(st.congestionRate / 1.4),
        level: congestionLevel(Math.round(st.congestionRate / 1.4)),
        is_transfer: isTransfer && stations.length > 0,
        arrival_offset_min: st.arrival_offset_min ?? 0,
      });
    });
  });

  if (stations.length) stations[0].is_transfer = false;

  const overall = Math.max(...stations.map((s) => s.station_congestion), 40);

  return {
    start: departure,
    end: destination,
    summary: {
      total_time_min: found.totalTime,
      transfer_count: found.transfers,
      payment: found.payment,
      overall_congestion: overall,
      overall_level: congestionLevel(overall),
    },
    stations,
    walk_transfers: found.walkTransfers ?? [],
    segments: [],
  };
}

function fallbackRouteResponse(targetTime, departure, destination) {
  const dep = departure.replace(/역$/, "");
  const dest = destination.replace(/역$/, "");
  const stationNames = [dep, dest];
  const offsetMin = estimateLocalRouteMinutes(2, 0);
  const stations = stationNames.map((name, i) => ({
    station_id: name,
    name,
    line: "2호선",
    station_congestion: 60 + i * 5,
    level: congestionLevel(60 + i * 5),
    is_transfer: false,
    arrival_offset_min: Math.round(i * (offsetMin / Math.max(1, stationNames.length - 1))),
  }));

  return {
    start: departure,
    end: destination,
    summary: {
      total_time_min: offsetMin,
      transfer_count: 0,
      payment: estimateSubwayPayment(2, 0),
      overall_congestion: 65,
      overall_level: congestionLevel(65),
    },
    stations,
    walk_transfers: [],
    segments: [],
  };
}

function buildRoutes(targetTime, departure = "연신내", destination = "봉은사") {
  const { fast, alt } = findRouteVariants(departure, destination, targetTime);

  if (fast) {
    const primary = finderToRouteResponse(fast, departure, destination);
    const alternative = alt ? finderToRouteResponse(alt, departure, destination) : undefined;
    return adaptApiRouteResponse(
      { ...primary, alternative, source: "mock" },
      targetTime,
    );
  }

  const fallback = fallbackRouteResponse(targetTime, departure, destination);
  return adaptApiRouteResponse({ ...fallback, source: "mock" }, targetTime);
}
const SLIDER_MARKS = ["17:30", "18:00", "18:30", "19:00", "19:30"];

const TODAY_EVENTS = [
  {
    id: "evt-1",
    priority: 1,
    impactScore: 140,
    emoji: "🎤",
    title: "잠실 콘서트",
    summary: "2만명 · 2호선 사당-잠실 18~20시 혼잡 140% 예상",
  },
  {
    id: "evt-5",
    priority: 2,
    impactScore: 125,
    emoji: "⚽",
    title: "잠실 스포츠 경기",
    summary: "석양 대관 · 2·9호선 잠실역 인근 퇴장 혼잡 125% 예상",
  },
  {
    id: "evt-2",
    priority: 3,
    impactScore: 95,
    emoji: "🌧️",
    title: "퇴근길 비 예보",
    summary: "18:00권 전반 혼잡도 상승 예상",
  },
  {
    id: "evt-3",
    priority: 4,
    impactScore: 72,
    emoji: "🚧",
    title: "2호선 선로 점검",
    summary: "건대입구-잠실 구간 열차 간격 5분 연장",
  },
  {
    id: "evt-4",
    priority: 5,
    impactScore: 60,
    emoji: "📢",
    title: "출근 시간대 안내",
    category: "commute",
    summary: "7~9시 1·4호선 혼잡 예상 · 여유 시간 확보 권장",
  },
];

function sliderIndexToDate(index, baseDate) {
  const time = SLIDER_MARKS[index] ?? "18:30";
  const [h, m] = time.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}
function dateToSliderIndex(date) {
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
export {
  SLIDER_MARKS,
  TODAY_EVENTS,
  buildRoutes,
  dateToSliderIndex,
  getChartData,
  getCongestionIndexForTime,
  getMacroDataForTime,
  getMacroDataFromDate,
  getPredictionsForTime,
  sliderIndexToDate
};
