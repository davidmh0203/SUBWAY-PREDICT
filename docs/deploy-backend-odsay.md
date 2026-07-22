# 백엔드 + ODsay 배포 가이드

Vercel은 **프론트만** 호스팅합니다. ODsay Server 키는 브라우저에 두면 안 되므로, FastAPI를 **별도 서버**에 올려야 실제 경로 탐색이 됩니다.

---

## 누가 무엇을 하나

### Agent(코드/설정) — 이미 준비된 것

| 항목 | 상태 |
|------|------|
| `ODSAY_API_KEY`를 백엔드에서만 사용 | ✅ |
| 로컬 `.env` 키 로드 + `ODSAY_FORCE_MOCK=0` | ✅ (로컬 확인됨) |
| CORS에 Vercel 도메인 기본 허용 + `CORS_ORIGINS` env | ✅ |
| `Dockerfile` / `render.yaml` | ✅ |
| FE가 `VITE_API_BASE_URL`로 API 호출 | ✅ |

### 사용자(계정·플랫폼) — 반드시 본인이 해야 함

1. **백엔드 호스팅** (Render / Railway / Fly.io 등)에 Docker 또는 FastAPI 배포  
2. 호스팅 대시보드에 **환경 변수** 등록 (키는 Git에 올리지 말 것)  
3. **ODsay LAB**에 백엔드 **출구(egress) IP** 등록  
4. **Vercel**에 `VITE_API_BASE_URL` = 백엔드 URL 설정 후 재배포  
5. (선택) 커스텀 도메인·HTTPS 확인

Agent는 ODsay / Vercel / Render 계정에 로그인하거나 IP를 등록할 수 없습니다.

---

## 1. 백엔드 배포 — Render Blueprint (A)

### 사전 (레포)

- 루트에 `Dockerfile`, `render.yaml`이 **GitHub에 푸시**되어 있어야 함
- 시크릿(`.env`)은 커밋하지 않음 → Render Environment에만 입력

### Blueprint 생성

1. [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**
2. GitHub 레포 `subway-predict-dashboard` 연결 (권한 허용)
3. Branch: `main` / Blueprint Path: `render.yaml` (기본)
4. `ODSAY_API_KEY` 등 `sync: false` 항목에 값 입력 후 **Apply**
5. 서비스 URL 예: `https://yeoyuro-api.onrender.com`

Free 플랜이 없거나 실패하면 Blueprint/서비스에서 plan을 `starter`로 바꾸면 됩니다.

### Environment (Blueprint가 안 넣은 값)

수동 Web Service로 만들 때도 동일:

| 변수 | 값 |
|------|-----|
| `ODSAY_API_KEY` | ODsay **Server** 키 (로컬 `.env`와 동일) |
| `ODSAY_FORCE_MOCK` | `0` |
| `CORS_ORIGINS` | `https://subway-predict-dashboard.vercel.app,http://localhost:5173` |
| `JWT_SECRET` | 긴 랜덤 문자열 |
| `DATA_GO_API_KEY` 등 | 있으면 함께 |

4. 배포 후 `https://<your-service>.onrender.com/health` → `{"status":"ok"}` 확인  
5. `https://<your-service>.onrender.com/docs` 에서 ODsay 관련 엔드포인트 스모크 테스트

로컬 Docker 확인:

```bash
docker build -t yeoyuro-api .
docker run --rm -p 8000:8000 \
  -e ODSAY_API_KEY="$ODSAY_API_KEY" \
  -e ODSAY_FORCE_MOCK=0 \
  yeoyuro-api
```

---

## 2. ODsay LAB — IP 등록 (사용자만 가능)

1. [ODsay LAB](https://lab.odsay.com/) 로그인  
2. 발급한 **Server API 키** 설정에서 **허용 IP**에 백엔드 출구 IP 추가  
3. IP 확인 방법:
   - Render: 서비스 로그/문서의 outbound IP, 또는 배포 서버에서 `curl ifconfig.me`  
   - 고정 IP가 없는 Free 플랜이면 Shared egress IP를 쓰거나, 고정 IP 플랜/프록시를 검토  
4. **Web 키는 백엔드에서 거부**됩니다. 반드시 Server 키.

미등록 IP로 호출하면 `ApiKeyAuthFailed` 등이 납니다. 키는 있어도 **플랫폼 IP 화이트리스트**가 막습니다.

---

## 3. Vercel 프론트 연결 (사용자만 가능)

1. Vercel 프로젝트 → Settings → Environment Variables  
2. 추가:

| 변수 | 값 예시 |
|------|---------|
| `VITE_API_BASE_URL` | `https://<your-service>.onrender.com` |

3. **Production**에 저장 후 **Redeploy** (Vite는 빌드 타임에 env를 박음)  
4. 배포 사이트에서 경로 검색 → Network에 `/api/...`가 아니라 백엔드 호스트로 가는지 확인  
5. CORS 에러가 나면 백엔드 `CORS_ORIGINS`에 실제 Vercel URL(프리뷰 포함)을 추가

---

## 4. 동작 확인 체크리스트

- [ ] `GET /health` 200  
- [ ] 백엔드 로그에 ODsay 호출 성공 (mock 아님)  
- [ ] Vercel에서 고속터미널 → 연신내 등 검색 시 실제 환승 경로  
- [ ] `ODSAY_FORCE_MOCK=0` 인데도 mock이면 → IP 미등록 또는 키 타입(Web) 문제

---

## 구조 요약

```
브라우저 (Vercel)
  └─ VITE_API_BASE_URL → FastAPI (Render 등)
                            └─ ODSAY_API_KEY → api.odsay.com
                               (허용 IP = 백엔드 egress)
```

키를 `VITE_`로 넣지 마세요. 번들에 노출됩니다.
