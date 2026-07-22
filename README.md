# 여유로

수도권 전철 **혼잡도 예측·경로 안내** 서비스입니다.  
출발·도착·시간을 입력하면 혼잡도 차트와 추천 경로를 보여 주고, 경로 상세에서는 호선별 다이어그램과 역별 혼잡도를 확인할 수 있습니다.

**라이브 데모:** https://subway-predict-dashboard.vercel.app

## 주요 화면

| 화면 | 설명 |
|------|------|
| 홈 | 출발/도착·시간 입력, 당일 정체 예보, 즐겨찾기 |
| 경로 결과 | 시간대별 혼잡 차트, 최단/쾌적 경로 비교 |
| 경로 상세 | 노선색 경로 다이어그램, 역별 혼잡도, 대안 안내 |
| 노선도 | 수도권 전철 지도에서 역 선택 후 검색 |

## 기술 스택

React (JSX) · Vite · Tailwind CSS · Recharts · FastAPI (백엔드, `backend/`)

## 실행 방법

### 프론트만 (목업 fallback)

```bash
npm install
npm run dev
```

### 프론트 + 백엔드 API 연동 (로컬)

터미널 1 — 백엔드 (`:8000`):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
fastapi dev app/main.py
```

터미널 2 — 프론트 (`:5173`, `/api` → 백엔드 프록시):

```bash
npm run dev
```

API 문서: http://localhost:8000/docs  
경로 검색은 `POST /predict/route`를 사용합니다 (ODsay 경로 + mock 혼잡도). 백엔드가 꺼져 있으면 경로 결과 화면은 자동으로 기존 목업 데이터로 fallback 합니다.

**ODsay 연동:** `ODSAY_API_KEY`는 `backend/.env` 또는 루트 `.env`에 **Server API 키**로 설정하세요. Web 키는 백엔드에서 `ApiKeyAuthFailed`가 납니다. [ODsay LAB](https://lab.odsay.com/)에서 IP 등록 후 Server 키 발급.

**배포(FE + 백엔드 + ODsay):** Vercel만으로는 ODsay가 동작하지 않습니다. FastAPI를 별도 호스트에 올리고 Vercel `VITE_API_BASE_URL`을 맞춥니다. 절차·역할 분담은 [`docs/deploy-backend-odsay.md`](docs/deploy-backend-odsay.md).

환경 변수 예시: [`.env.example`](.env.example) · [`backend/.env.example`](backend/.env.example)

빌드 및 배포:

```bash
npm run build
npm run deploy          # 빌드 + Vercel만
npm run ship -- "메시지"  # 빌드 + 커밋 + push + 배포 (권장)
```

자세한 릴리스 절차: [`docs/RELEASE.md`](docs/RELEASE.md) · Agent 워크플로: [`AGENTS.md`](AGENTS.md)

## 베이스라인

목업 1차 베이스라인: [`mockup-first-baseline`](https://github.com/davidmh0203/SUBWAY-PREDICT/releases/tag/mockup-first-baseline)
