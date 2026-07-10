# ODsay 경로 응답 계약 (프론트·백엔드)

ODsay `searchPubTransPathT` / `searchStation` 응답을 앱 UI(`RouteResultsScreen`, `RouteDetailScreen`)가 쓰는 형태로 정리한 문서입니다.  
라이브 API 없이도 [`src/lib/fixtures/odsay-path-sample.json`](../src/lib/fixtures/odsay-path-sample.json)으로 동일 파이프라인을 검증할 수 있습니다.

## 데이터 흐름

```
ODsay result.path[]
  → odsay-to-route.js (parseOdsayResult)
  → RouteResponse (확장)
  → route-adapter.js (adaptApiRouteResponse)
  → UiRoute[] (추천 2카드)
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
| `path[0]`, `path[1]` | primary / `alternative` | 추천 2카드 |

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
| `alternative` (2번째 path) | 두 번째 카드 (`id: alt`) | 대안 경로 |

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

향후 백엔드가 ODsay 필드를 그대로 넘길 때 프론트 변경을 최소화하기 위해 `RouteSummary`에 `payment`를 추가합니다.  
`arrival_offset_min`, `walk_transfers`는 프론트 `odsay-to-route.js`에서 계산하거나, 추후 `RouteStation` / `RouteLeg` 모델로 확장할 수 있습니다.

## 픽스처 사용

```javascript
import sample from "@/lib/fixtures/odsay-path-sample.json";
import { parseOdsayResult } from "@/lib/api/odsay-to-route";
import { adaptApiRouteResponse } from "@/lib/api/route-adapter";

const { primary, alternative } = parseOdsayResult(sample.result, {
  start: "당산",
  end: "합정",
  departureTime: new Date(),
});
const routes = adaptApiRouteResponse(
  { ...primary, alternative },
  departureTime,
);
```
