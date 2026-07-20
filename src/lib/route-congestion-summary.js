import { flattenRouteStations } from "@/components/RouteCongestionStrip";
import { stripStationSuffix } from "@/lib/station-name";

/**
 * 경로 카드·정렬용 혼잡 요약.
 * 쾌적/카드 % = 출발 역에 가중치를 둔 경로 평균 (승차 체감 우선).
 * maxCongestion = 경로 전체 피크(스트립·주의 표시용).
 */

/** 출발 역 가중치 (나머지 역 = 1) */
export const DEPARTURE_CONGESTION_WEIGHT = 2;

export function getDepartureCongestion(route) {
  if (route == null) return 0;
  if (Number.isFinite(route.departureCongestion)) {
    return Number(route.departureCongestion);
  }

  const originNorm = stripStationSuffix(route.stations?.[0] ?? "");
  if (route.stationPredictions?.length) {
    const pred =
      route.stationPredictions.find(
        (p) => stripStationSuffix(p.stationName) === originNorm,
      ) ?? route.stationPredictions[0];
    if (pred && Number.isFinite(pred.congestionRate)) {
      return pred.congestionRate;
    }
  }

  const firstSeg = route.segments?.[0]?.stations?.[0];
  if (firstSeg && Number.isFinite(firstSeg.congestionRate)) {
    return firstSeg.congestionRate;
  }

  const flat = flattenRouteStations(route.segments);
  if (flat.length && Number.isFinite(flat[0].congestionRate)) {
    return flat[0].congestionRate;
  }

  return Number.isFinite(route.maxCongestion) ? route.maxCongestion : 0;
}

export function getArrivalCongestion(route) {
  if (route == null) return 0;
  if (Number.isFinite(route.arrivalCongestion)) {
    return Number(route.arrivalCongestion);
  }

  const destNorm = stripStationSuffix(
    route.stations?.[route.stations.length - 1] ?? "",
  );
  if (route.stationPredictions?.length) {
    const pred = [...route.stationPredictions]
      .reverse()
      .find((p) => stripStationSuffix(p.stationName) === destNorm);
    if (pred && Number.isFinite(pred.congestionRate)) {
      return pred.congestionRate;
    }
  }

  const flat = flattenRouteStations(route.segments);
  const last = flat[flat.length - 1];
  if (last && Number.isFinite(last.congestionRate)) {
    return last.congestionRate;
  }

  return getDepartureCongestion(route);
}

/**
 * 출발 역 가중 평균.
 * (w·출발 + Σ중간·도착) / (w + n−1), w = DEPARTURE_CONGESTION_WEIGHT
 */
export function getDepartureWeightedAvg(route) {
  if (route == null) return 0;
  if (Number.isFinite(route.departureWeightedCongestion)) {
    return Number(route.departureWeightedCongestion);
  }

  const stations = flattenRouteStations(route.segments);
  if (stations.length === 0) {
    return getDepartureCongestion(route);
  }

  const rates = stations.map((s) => Number(s.congestionRate) || 0);
  const w = DEPARTURE_CONGESTION_WEIGHT;
  const weightedSum =
    w * rates[0] + rates.slice(1).reduce((a, b) => a + b, 0);
  const weightTotal = w + Math.max(0, rates.length - 1);
  return Math.round(weightedSum / weightTotal);
}

export function getRouteCongestionStats(route) {
  const stations = flattenRouteStations(route.segments);
  const rates = stations.map((s) => Number(s.congestionRate) || 0);
  const max = rates.length ? Math.max(...rates) : route.maxCongestion ?? 0;
  const avg = rates.length
    ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
    : 0;
  const peak = stations.find((s) => s.congestionRate === max);
  const departure = getDepartureCongestion(route);
  const arrival = getArrivalCongestion(route);
  const departureWeighted = getDepartureWeightedAvg(route);

  return {
    departure,
    arrival,
    max,
    avg,
    departureWeighted,
    peakName: peak?.name?.replace(/역$/u, "") ?? "",
    departureName: stripStationSuffix(route.stations?.[0] ?? stations[0]?.name ?? ""),
  };
}

/** 카드 우측 % 뱃지 — 출발 가중 평균 */
export function getCardCongestionRate(route) {
  return getDepartureWeightedAvg(route);
}

/** 「쾌적」 뱃지·정렬용 — 출발 가중 평균 */
export function getComfortRankRate(route) {
  return getDepartureWeightedAvg(route);
}
