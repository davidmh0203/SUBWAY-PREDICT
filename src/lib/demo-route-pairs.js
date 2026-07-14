/**
 * 다중 경로(카드 2장+) 확인용 출발·도착 샘플.
 * 전부 로컬 ODsay 형태 픽스처와 연결됩니다. (단일 경로 OD는 넣지 않음)
 */
export const DEMO_ROUTE_PAIRS = [
  {
    id: "cityhall-dongdaemun",
    label: "시청 → 동대문",
    hint: "1호선 직행 vs 2·3·1호선 우회",
    departure: "시청역",
    destination: "동대문역",
    departureStationId: "시청|1호선",
    destinationStationId: "동대문|1호선",
  },
  {
    id: "sadang-jongno3",
    label: "사당 → 종로3가",
    hint: "4호선 직행 vs 2·3호선 환승",
    departure: "사당역",
    destination: "종로3가역",
    departureStationId: "사당|4호선",
    destinationStationId: "종로3가|3호선",
  },
  {
    id: "seoul-wangsimni",
    label: "서울역 → 왕십리",
    hint: "1호선 vs 4·2호선 환승",
    departure: "서울역",
    destination: "왕십리역",
    departureStationId: "서울역|1호선",
    destinationStationId: "왕십리|2호선",
  },
  {
    id: "hapjeong-jamsil",
    label: "합정 → 잠실",
    hint: "2호선 직행 vs 6·5·2호선 우회",
    departure: "합정역",
    destination: "잠실역",
    departureStationId: "합정|2호선",
    destinationStationId: "잠실|2호선",
  },
];

export function findDemoRoutePair(departure, destination) {
  const dep = String(departure ?? "")
    .replace(/역.*$/, "")
    .trim();
  const dest = String(destination ?? "")
    .replace(/역.*$/, "")
    .trim();
  return DEMO_ROUTE_PAIRS.find(
    (p) =>
      p.departure.replace(/역.*$/, "").trim() === dep &&
      p.destination.replace(/역.*$/, "").trim() === dest,
  );
}
