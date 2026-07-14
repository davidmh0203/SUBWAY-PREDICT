# ODsay 경로 응답 계약 (프론트·백엔드)

ODsay `searchPubTransPathT` / `searchStation` 응답을 앱 UI(`RouteResultsScreen`, `RouteDetailScreen`)가 쓰는 형태로 정리한 문서입니다.  
라이브 API 없이도 [`src/lib/fixtures/odsay-path-sample.json`](../src/lib/fixtures/odsay-path-sample.json)으로 동일 파이프라인을 검증할 수 있습니다.

## 데이터 흐름

```
ODsay result.path[]
  → odsay-to-route.js (parseOdsayResult)  // primary + alternatives[]
  → RouteResponse (확장, alternatives)
  → route-adapter.js (adaptApiRouteResponse)
  → UiRoute[] (경로 카드 N장)
  → RouteResultsScreen / RouteDetailScreen
```

## ODsay raw → RouteResponse

| ODsay 필드 | RouteResponse | 비고 |
|------------|---------------|------|
| `path[].info.totalTime` | `summary.total_time_min` | 분 |
| `path[].info.payment` | `summary.payment` | 원 |
| `path[].info.subwayTransitCount` | `summary.transfer_count` | 지하철 환승 횟수 |
| `path[].subPath[trafficType=1].lane.name` | `stations[].line` | 호선 라벨 정규화 |
| `path[].subPath[trafficType=1].passStopList.stations[]` | `stations[]` | 역 순서 |
| `path[].subPath[].sectionTime` | `stations[].arrival_offset_min` | 구간 시간 누적 |
| `path[].subPath[trafficType=1].way` | `stations[].heading` | 방면 |
| `path[].subPath[trafficType=3]` | `walk_transfers[]` | 도보 환승 분 |
| `path[0]` | top-level `summary`/`stations`/… | 1번 추천 경로 |
| `path[1…]` | `alternatives[]` | 추가 경로 (최대 4개, 합 5) |

혼잡도(`station_congestion`, `overall_congestion`)는 ODsay에 없음 → 출발 시각 hour 기반 목업.

## RouteResponse (확장) → UiRoute

| RouteResponse | UiRoute | UI 위치 |
|---------------|---------|---------|
| `summary.total_time_min` | `totalTime` | 추천 카드 |
| `summary.payment` | `payment` | 추천 카드 |
| `summary.transfer_count` | `transfers` | 추천 카드 |
| `stations[].line` (첫 호선) | `lineName` | 추천 카드 |
| `stations[].name` | `stations`, `description` | 상세 헤더·카드 요약 |
| `stations[].arrival_offset_min` | `segments[].stations[].arrivalTime` | 상세 다이어그램 |
| `stations[].heading` | `stationPredictions[].heading` | 역별 예측 |
| `walk_transfers[]` | `segments[].walkAfter.minutes` | 도보 환승 N분 |
| `path` N개 (primary+alternatives) | `UiRoute[]` N장 | 추천 경로 목록 |

쾌적/혼잡 우선 카드는 별도 UX 시안으로 두고, 현재는 **실제 다른 경로만** 카드로 노출합니다.

## UiRoute 세그먼트 타입

```typescript
type UiSegment = {
  lineName: string;
  lineColor: string;
  stations: {
    name: string;
    type: "departure" | "arrival" | "transfer" | "waypoint";
    arrivalTime: string;
    congestionRate: number;
    congestionStatus: string;
  }[];
  walkAfter?: { minutes: number }; // 다음 호선 승차 전 도보
};
```

## 백엔드 스키마 초안 (`backend/app/schemas.py`)

`RouteResponse.alternatives: list[RouteOption]`으로 ODsay `path[1…]`를 전달합니다.  
`arrival_offset_min`, `walk_transfers`는 프론트 `odsay-to-route.js`에서 계산하거나, 추후 `RouteStation` / `RouteLeg` 모델로 확장할 수 있습니다.

## 픽스처 사용

```javascript
import sample from "@/lib/fixtures/odsay-path-sample.json";
import { parseOdsayResult } from "@/lib/api/odsay-to-route";
import { adaptApiRouteResponse } from "@/lib/api/route-adapter";

const { primary, alternatives } = parseOdsayResult(sample.result, {
  start: "당산",
  end: "합정",
  departureTime: new Date(),
});
const routes = adaptApiRouteResponse(
  { ...primary, alternatives },
  departureTime,
);
// routes.length === path 중복 제거 후 개수 (픽스처는 보통 2)
```
