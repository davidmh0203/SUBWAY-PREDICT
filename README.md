# SUBWAY PREDICT

수도권 전철 **혼잡도 예측·경로 안내** 모바일 웹 목업입니다.  
출발·도착·시간을 입력하면 혼잡도 차트와 추천 경로를 보여 주고, 경로 상세에서는 호선별 다이어그램과 칸별 혼잡 히트맵을 확인할 수 있습니다.

**라이브 데모:** https://subway-predict-dashboard.vercel.app

## 주요 화면

| 화면 | 설명 |
|------|------|
| 홈 | 출발/도착·시간 입력, 당일 정체 예보, 즐겨찾기 |
| 경로 결과 | 시간대별 혼잡 차트, 최단/쾌적 경로 비교 |
| 경로 상세 | 노선색 경로 다이어그램, 칸별 혼잡도, 대안 안내 |
| 노선도 | 수도권 전철 지도에서 역 선택 후 검색 |

## 기술 스택

React (JSX) · Vite · Tailwind CSS · Recharts

## 실행 방법

```bash
npm install
npm run dev
```

빌드 및 배포:

```bash
npm run build
npm run deploy
```

## 베이스라인

목업 1차 베이스라인: [`mockup-first-baseline`](https://github.com/davidmh0203/SUBWAY-PREDICT/releases/tag/mockup-first-baseline)
