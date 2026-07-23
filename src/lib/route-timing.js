/** 출발 시각 + 경과 분 → HH:mm */
export function formatArrivalTime(departureTime, offsetMinutes) {
  const d = new Date(departureTime.getTime() + offsetMinutes * 60_000);
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Date → "HH:MM" (즐겨찾기에 출발 시각만 저장할 때 사용) */
export function formatHHMM(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** 역 수·환승 수로 요금 추정 (ODsay payment 대체) */
export function estimateSubwayPayment(stationCount, transferCount) {
  const base = 1400;
  const extraStops = Math.max(0, stationCount - 2);
  const transferFare = Math.max(0, transferCount) * 50;
  return base + Math.min(extraStops * 20, 400) + transferFare;
}

/** 구간 역 수와 총 분을 균등 배분해 역별 도착 오프셋(분) 반환 */
export function distributeStopOffsets(stationCount, sectionMinutes) {
  if (stationCount <= 1) return [0];
  const offsets = [0];
  const step = sectionMinutes / (stationCount - 1);
  for (let i = 1; i < stationCount; i += 1) {
    offsets.push(Math.round(step * i));
  }
  return offsets;
}

/** 로컬 그래프 경로: 정거장 간 2.2분, 환승 도보 4분 */
export const MOCK_MINUTES_PER_STOP = 2.2;
export const MOCK_WALK_TRANSFER_MINUTES = 4;

export function estimateLocalRouteMinutes(totalStops, transferCount) {
  const ride = Math.max(0, totalStops - 1) * MOCK_MINUTES_PER_STOP;
  const walk = Math.max(0, transferCount) * MOCK_WALK_TRANSFER_MINUTES;
  return Math.round(ride + walk);
}
