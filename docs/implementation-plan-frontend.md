# 여유로 — 프론트엔드 수정 구현 계획


| 항목    | 내용                                                            |
| ----- | ------------------------------------------------------------- |
| 기준 문서 | `[requirements-frontend.md](./requirements-frontend.md)` v1.0 |
| 계획 버전 | v1.0                                                          |
| 작성일   | 2026-07-07                                                    |
| 상태    | 구현 완료                                                    |


---

## 1. 요구사항 해석 요약

요구사항 문서 §5의 미결 질문에 대해 **목업 1차 스프린트** 관점에서 아래와 같이 해석한다. 구현 시 이 가정을 전제로 진행하고, 변경 시 본 문서를 갱신한다.


| #   | 질문         | 해석·결정                                                                                                                                                    |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PC 반응형 형태  | **모바일 퍼스트 + 중앙 정렬 확장형**. `max-w-md` → `max-w-md md:max-w-2xl lg:max-w-4xl`. PC에서도 **하단 탭 유지**(앱 목업 정체성). `md+`에서 상세 화면은 **2열 그리드**(좌: 경로·혼잡도, 우: 지도) 검토. |
| 2   | 큰 이벤트 우선순위 | mock `priority` (1=최우선) + `impactScore`(혼잡 예측 % 또는 인원) **내림차순** 정렬. 동점 시 `impactScore` 우선.                                                               |
| 3   | 열차 혼잡도 단위  | **역별 1값** (`overallRate` 이미 `crowd-data.js`에 존재). 칸 배열은 데이터에서 제거·미사용.                                                                                    |
| 4   | 레전드 %      | `congestion.js`의 `rateToCrowdLevel` 구간을 **고정 % 범위**로 문서화·표시: 여유 ≤55%, 보통 56–85%, 혼잡 86–115%, 매우혼잡 ≥116%.                                                 |
| 5   | 경로 길이 해결   | **1순위: 네이버 지도식 토글(B)**. `RouteSchematic`·혼잡도 리스트 **동일 접기 규칙** 적용. 가로 타임라인(A)은 이번 스프린트 제외.                                                                |
| 6   | 상세 지도      | **1차: A안** — `RouteMiniMap` 단순 SVG(dot+line), 경로 역·호선만. **2차(B안)**: 사용자 확인 후 `InteractiveMetroMap` 임베드.                                                  |
| 7   | 서울시 역 범위   | `lib/seoul-metro-stations.js`에 **서울시 1–9호선 + 우이·신림 등 서울메트로 관할** 역 화이트리스트(mock). `metro-network` 필터 함수로 재사용.                                              |
| 8   | 비서울 역 경로   | **경로 검색·텍스트는 유지**. 지도/노선도에서는 **서울 역만 렌더**, 비서울 역은 리스트에만 표시 + 지도에 「데이터 범위 외」 안내 배지.                                                                       |


### 해석상 핵심 원칙

1. **목업 우선**: mock 데이터 확장으로 UX 완성, API 연동 없음.
2. **세로 스크롤 최소화**: 홈 캐러셀·상세 접기·PC 2열로 해결.
3. **기존 디자인 언어 유지**: `CROWD_COLORS`, `CrowdBlock`, `CONGESTION_STYLES` 재사용.
4. **점진적 커밋**: 화면 단위 PR/커밋 4~5개로 분리.

---

## 2. 영향 범위 맵

```
App.jsx (반응형 셸)
├── HomeScreen.jsx          ← 회원/즐겨찾기 제거, 캐러셀
├── RouteResultsScreen.jsx  ← 반응형만
├── RouteDetailScreen.jsx   ← 레이아웃 재구성
│   ├── RouteSchematic.jsx      ← 접기/펼치기
│   ├── TrainCongestionList.jsx ← 신규 (CarCongestionHeatmap 대체)
│   └── RouteMiniMap.jsx        ← 신규
├── MacroViewScreen.jsx     ← 서울 필터 안내
└── InteractiveMetroMap.jsx ← filter props 추가

lib/
├── congestion.js           ← CROWD_PERCENT_RANGES export
├── crowd-data.js           ← 역별 overallRate만, 이벤트 mock
├── seoul-metro-stations.js ← 신규 화이트리스트
└── metro-network.js      ← filterSeoulStations/Segments
```

---

## 3. 구현 단계 (권장 순서)

### Phase 0 — 공통 기반 (선행)

**목표:** 이후 화면 작업이 공유하는 상수·데이터·유틸 준비.


| 작업  | 파일                            | 내용                                                                  |
| --- | ----------------------------- | ------------------------------------------------------------------- |
| 0-1 | `lib/congestion.js`           | `CROWD_PERCENT_RANGES` 추가, `CongestionLegend`용 헬퍼                   |
| 0-2 | `lib/seoul-metro-stations.js` | 서울메트로 관할 역 `Set` (1–9호선 핵심역 + mock-data 경로 역 포함)                    |
| 0-3 | `lib/metro-network.js`        | `filterStations(ids)`, `filterSegmentsForRoute(stationIds)` export  |
| 0-4 | `lib/crowd-data.js`           | `getTrainCongestionRows()` — `overallRate` + `level`만 반환            |
| 0-5 | `lib/mock-data.js`            | `TODAY_EVENTS` mock 배열 (`priority`, `impactScore`, `title`, `body`) |


**완료 조건:** import 오류 없음, 기존 빌드 유지.

---

### Phase 1 — 홈 (`HomeScreen`)

**난이도:** 낮음 · **예상:** 0.5일


| ID  | 작업                | 상세                                                                                       |
| --- | ----------------- | ---------------------------------------------------------------------------------------- |
| 1-1 | 회원 아이콘 제거         | `User` 버튼·import 삭제. 헤더는 설정 + 타이틀 **2열 균형** (`justify-between` → 타이틀 중앙 유지 시 spacer div) |
| 1-2 | 자주 가는 경로 제거       | `Star` 섹션 전체 삭제                                                                          |
| 1-3 | 정체 예보 캐러셀         | `TrafficForecastCarousel.jsx` 신규                                                         |
|     |                   | - `overflow-x-auto snap-x snap-mandatory` + 터치 스와이프                                      |
|     |                   | - 카드 고정 높이 `min-h-[88px] max-h-[88px]`                                                   |
|     |                   | - `TODAY_EVENTS` 정렬 후 map                                                                |
|     |                   | - 하단 dot indicator + 마지막 카드가 아닐 때 `pr-4`로 다음 카드 peek                                     |
| 1-4 | HomeScreen JSX 정리 | `createElement` → 가독성 JSX로 리라이트 (선택, 같은 PR 가능)                                           |


**수용:** AC-02, AC-03, AC-04

---

### Phase 2 — 경로 상세 혼잡도 (`RouteDetailScreen` 핵심)

**난이도:** 중간 · **예상:** 1일


| ID  | 작업                           | 상세                                                  |
| --- | ---------------------------- | --------------------------------------------------- |
| 2-1 | `TrainCongestionList.jsx` 신규 | `CarCongestionHeatmap` 대체                           |
|     |                              | - 좌: 역명 + 호선 색 라인 (기존과 동일)                          |
|     |                              | - 우: 역당 **단일 `CrowdBlock`** (너비 `w-full` 또는 `w-12`) |
|     |                              | - `overallRate` 숫자 역 옆 소형 표시                        |
| 2-2 | `CongestionLegend.jsx` 개선    | `showPercentRanges` prop: 라벨 + `≤55%` 형식            |
|     |                              | - compact 모드에서도 텍스트+% 작은 폰트로 표시                     |
| 2-3 | `RouteDetailScreen` 교체       | `CarCongestionHeatmap` → `TrainCongestionList`      |
| 2-4 | `CarCongestionHeatmap.jsx`   | 사용처 없으면 삭제 또는 deprecated 주석                         |


**수용:** AC-05, AC-06

---

### Phase 3 — 경로 상세 접기 + 미니 지도

**난이도:** 높음 · **예상:** 1.5일

#### 3-A. 접기/토글 (네이버 지도식)


| ID  | 작업                                | 상세                                                               |
| --- | --------------------------------- | ---------------------------------------------------------------- |
| 3-1 | `lib/route-station-groups.js` 신규  | `segments` → flat station list + `isKeyStation` (출발/도착/환승)       |
|     |                                   | - 연속 `waypoint`를 **collapse group**으로 묶음                         |
| 3-2 | `CollapsibleRouteStations.jsx` 신규 | 그룹 UI: 「N개 역 ▼」 버튼, 펼치면 중간역 리스트                                  |
| 3-3 | `RouteSchematic.jsx` 리팩터          | key station만 기본 렌더, waypoint 그룹은 `CollapsibleRouteStations`      |
| 3-4 | `TrainCongestionList` 연동          | schematic과 **동일 group state** 공유 (`expandedGroups: Set<string>`) |
|     |                                   | - 접힌 구간: key 역만 혼잡도 행 표시, 펼치면 전체 역                               |


**UX 상세**

- 기본: 출발 · (환승) · 도착 + 「사이 5개 역」접힌 줄
- 탭 시 accordion 애니메이션 (`max-h-0` → `max-h-*`)
- 환승역은 항상 key station

#### 3-B. 경로 미니 지도


| ID  | 작업                             | 상세                                                           |
| --- | ------------------------------ | ------------------------------------------------------------ |
| 3-5 | `RouteMiniMap.jsx` 신규 **(A안)** | props: `routeStationIds`, `highlightLineColors`              |
|     |                                | - `metro-network` 좌표로 경로 역 **dot + 호선 polyline**만 SVG 렌더     |
|     |                                | - viewBox를 경로 bounding box에 **auto-fit** (padding 12%)       |
|     |                                | - 높이 `h-48 md:h-64`, `rounded-xl` 카드, 줌/팬 없음                 |
| 3-6 | `InteractiveMetroMap.jsx` 확장   | **B안(2차) 전용** — 1차에서는 미구현. 사용자 승인 시 `visibleStationIds` 등 추가 |
| 3-7 | `RouteDetailScreen` 배치         | 순서: 헤더 → 접이식 schematic → 혼잡도 → 대안 → **RouteMiniMap**         |
|     |                                | - 비서울 역 포함 시 지도 상단 `서울시 제공 역만 표시됩니다` 배지                      |


**수용:** AC-07, AC-08

---

### Phase 4 — 노선도 서울 필터

**난이도:** 중간 · **예상:** 0.5일


| ID  | 작업                    | 상세                                                    |
| --- | --------------------- | ----------------------------------------------------- |
| 4-1 | `MacroViewScreen.jsx` | 상단 안내 문구: 「서울시 관할 역만 표시 (목업 데이터 범위)」                  |
| 4-2 | `InteractiveMetroMap` | `seoulOnly={true}` 기본값, 비서울 역 `display:none` 또는 렌더 스킵 |
| 4-3 | 세그먼트 필터               | 양端 모두 서울 역인 segment만 표시 (고립 segment 최소화)              |
| 4-4 | 범례                    | 비활성 호선은 범례에서도 숨기거나 흐리게                                |


**수용:** AC-09

---

### Phase 5 — 전체 반응형

**난이도:** 중간 · **예상:** 0.5~1일


| ID  | 작업                        | 상세                                                                |
| --- | ------------------------- | ----------------------------------------------------------------- |
| 5-1 | `App.jsx`                 | 루트: `max-w-md` → `max-w-lg md:max-w-2xl lg:max-w-4xl`             |
|     |                           | - `macro` 뷰: `lg:px-6`                                            |
| 5-2 | `RouteDetailScreen`       | `md:grid md:grid-cols-2 md:gap-6` — 좌: schematic+혼잡, 우: 지도 sticky |
| 5-3 | `RouteResultsScreen`      | 차트 `min-h` 반응형, 카드 padding 조정                                     |
| 5-4 | `TrafficForecastCarousel` | `md:`에서 카드 너비 `min-w-[80%]` → `min-w-[45%]` (2장 peek)             |
| 5-5 | 하단 nav                    | `max-w-*` App과 동기화 (이미 `left-1/2` 패턴)                             |


**수용:** AC-01

---

### Phase 6 — 마무리


| ID  | 작업                           |
| --- | ---------------------------- |
| 6-1 | `npm run build` 통과 (AC-10)   |
| 6-2 | README 주요 화면 설명 갱신           |
| 6-3 | Vercel 배포 (`npm run deploy`) |
| 6-4 | 요구사항 문서 상태 → 「구현 완료」로 갱신     |


---

## 4. 신규·변경 컴포넌트 API (초안)

### `TrafficForecastCarousel`

```js
// props
{ events: Array<{ id, priority, impactScore, emoji?, title, summary, highlight? }> }
```

### `TrainCongestionList`

```js
// props
{
  rows: Array<{ stationName, overallRate, level }>,
  departureTime: Date,
  lineColor?: string,
  collapsedGroups?: Set<string>,  // optional, Phase 3
  onToggleGroup?: (groupId) => void
}
```

### `RouteMiniMap`

```js
// props
{
  stationIds: string[],
  segmentLineColors?: string[],
  seoulOnly?: boolean  // default true
}
```

### `CongestionLegend`

```js
// props 추가
{ compact?: boolean, showPercentRanges?: boolean }
```

---

## 5. 데이터 변경 상세

### 5.1 `TODAY_EVENTS` (mock)

```js
[
  {
    id: "evt-1",
    priority: 1,
    impactScore: 140,
    emoji: "🎤",
    title: "잠실 콘서트",
    summary: "2만명 · 2호선 사당-잠실 18~20시 혼잡 140% 예상",
  },
  {
    id: "evt-2",
    priority: 2,
    impactScore: 95,
    emoji: "🌧️",
    title: "퇴근길 비 예보",
    summary: "18:00권 전반 혼잡도 상승 예상",
  },
  // +1~2개 더 (캐러셀 테스트용)
];
```

### 5.2 `getTrainCongestionRows(timeOffset)`

```js
// 반환 형태
[{ stationName: "사당", overallRate: 132, level: "VERY_BUSY" }, ...]
```

### 5.3 서울 역 화이트리스트

- 1차: **수동 목록** (~200역, 서울 1–9호선 중심)
- `metro-stations.json`에서 `id` 매칭으로 좌표는 기존 유지
- 경기/인천 역(수원, 부평, 인천 등)은 `Set`에 **미포함**

---

## 6. 커밋 분리 제안


| 순서  | 커밋 메시지 (한글)             |
| --- | ----------------------- |
| 1   | `공통 혼잡도·서울역 필터 데이터 추가`  |
| 2   | `홈 UI 정리 및 정체 예보 캐러셀`   |
| 3   | `경로 상세 열차 혼잡도 및 레전드 개선` |
| 4   | `경로 상세 접기 UI 및 미니 지도`   |
| 5   | `노선도 서울시 역 필터 적용`       |
| 6   | `반응형 레이아웃 적용`           |


---

## 7. 리스크·완화


| 리스크                        | 영향                | 완화                                           |
| -------------------------- | ----------------- | -------------------------------------------- |
| `InteractiveMetroMap` 복잡도  | 미니 지도 일정 지연       | **확정: 1차 A안**(단순 SVG). B안은 사용자 확인 후 별도 Phase |
| 서울 역 목록 불완전                | 지도에 역 누락          | mock 경로 역은 화이트리스트에 **반드시 포함**                |
| 접기 state 동기화               | schematic·혼잡도 불일치 | 단일 `useRouteCollapse` hook                   |
| `HomeScreen` createElement | 수정 가독성 낮음         | Phase 1에서 JSX 리라이트                           |
| 반응형 2열                     | 모바일 회귀            | mobile-first 개발 후 `md:` breakpoint 추가        |


---

## 8. 테스트 체크리스트

### 홈

- [ ] 프로필·자주가는 경로 없음
- [ ] 이벤트 3개+ 가로 스와이프
- [ ] 첫 슬라이드 priority 1 이벤트
- [ ] dot/peek 힌트 표시

### 경로 상세

- [ ] 8칸 그리드 없음, 역당 1 블록
- [ ] 레전드에 여유~매우혼잡 + % 범위
- [ ] 기본 접힘: 출발·환승·도착만
- [ ] 「N개 역」펼치기 동작
- [ ] 하단 지도에 경로만 표시

### 노선도

- [ ] 수원·인천 등 비서울 역 미표시
- [ ] 안내 문구 표시

### 반응형

- [ ] 390px / 768px / 1280px 레이아웃 확인
- [ ] `npm run build` 성공

---

## 9. 구현 시 Agent 프롬프트 (단계별)

각 Phase를 **별도 Composer 채팅**에서 실행:

```
@docs/implementation-plan-frontend.md Phase 1만 구현해줘.
다른 Phase는 건드리지 마. 완료 후 build 확인.
```

```
@docs/implementation-plan-frontend.md Phase 2만 구현해줘.
TrainCongestionList는 CrowdBlock 스타일 재사용.
```

(Phase 3~5 동일 패턴)

---

## 10. 요구사항 ↔ 플랜 추적


| 요구사항 ID         | Phase | AC    |
| --------------- | ----- | ----- |
| 2.1 반응형         | 5     | AC-01 |
| 2.2.1 회원 아이콘    | 1     | AC-02 |
| 2.2.2 자주가는 경로   | 1     | AC-03 |
| 2.2.3 정체 예보 캐러셀 | 1     | AC-04 |
| 2.4.1 열차 혼잡도    | 2     | AC-05 |
| 2.4.2 레전드 %     | 2     | AC-06 |
| 2.4.3 접기 UX     | 3     | AC-07 |
| 2.4.4 미니 지도     | 3     | AC-08 |
| 2.5.1 서울 역만     | 4     | AC-09 |
| 빌드              | 6     | AC-10 |


---

## 11. 다음 액션

1. ~~사용자 §1 해석 가정 승인~~ ✅
2. ~~미니 지도 A/B 선택~~ ✅ **1차 A안**(단순 SVG), 괜찮으면 사용자 요청 시 B안
3. **Phase 0 → 1**부터 Agent 모드로 구현 시작

