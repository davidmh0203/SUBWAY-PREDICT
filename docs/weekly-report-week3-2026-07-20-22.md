# J1L4 3주차 주간 보고서 (7/20~7/24) — 이민형 (구현·리서치 중심)

**팀명:** J1L4  
**작성자:** 이민형  
**기간:** 2026. 7. 20. ~ 7. 24.  
**제외:** Figma·Notion MCP·발표 초안/슬라이드 문구 작업  
**근거:** GitHub `main` 커밋(KST) · Cursor 구현 채팅 · `docs/model-validation-notes.md` · `docs/deploy-backend-odsay.md` · `docs/supabase-setup.md`

---

## 1. 세부수행내용 (과업)

카카오맵을 노선도 탭(노선도|실제지도)에 통합하고 고도화 혼잡 모델·Supabase 인증을 반영한 뒤, Render/Docker·ODsay·Vercel 배포를 안정화했다. SMPA 집회 자동 동기화·1~8호선 범위·경로 UX 버그를 고치고, 혼잡 예측 원인 UI와 홈 주변역 실모델 batch를 적용했다.

---

## 2. 주간 활동 내용 (일자별)

### 7월 20일 (월)

#### [본인] 카카오맵 · 모델 · Supabase

| 시각(채팅) | 내용 | GitHub |
|------------|------|--------|
| 10:53~ | 전역 혼잡 지도 진입 UX — 하단 내비 vs 노선도 탭 내 토글 | — |
| 10:54~11:07 | 노선도 / 실제지도 모드 프리뷰, 흰 화면(로딩) 이슈 | — |
| 11:07~ | `feature/kakao-map-in-macro` → main | **`1d2074b`** — 카카오맵을 노선도 탭 실제 지도 모드로 통합 |
| 16:40~ | 팀원 `origin/KakaoMap2` (`97a7f67`) 확인 — `#map` 전체화면 MapScreen | 팀원 커밋 |
| 16:48~16:57 | 합치기: 지도=팀원, 진입=**노선도\|카카오** 토글. 로컬 MySQL 로그인 불안정 → **Supabase** 검토 | — |
| ~19:01 | 고도화 혼잡 모델 + Supabase + 지도 UI | **`4383617`** |
| 19:14 | 혼잡 % 왜곡 = **이벤트 베이스라인 오염** 문서화 | **`64e4fc2`** |

**구현 요지**

- `#macro`에서 **노선도(SVG) | 실제 지도(카카오)** 전환. 팀원 `MapScreen`(혼잡 마커·실좌표)을 embedded로 수용 (standalone `#map` 아님).
- `VITE_SUPABASE_*` 있으면 Supabase Auth·즐겨찾기 (`docs/supabase-setup.md`).
- advanced LightGBM/XGBoost·원인 모델·KOPIS/축제 lookup 등 백엔드 반영.
- 절대 %는 이벤트 평균 오염으로 신뢰 저하 → AI팀 보정 대기, UI는 참고용.

#### [팀원]

- `97a7f67` (leetaeyeon11111) — 카카오맵·실좌표. (당시 main 히스토리 미연결 → 7/24 ours 머지로 Contributors 반영)

---

### 7월 21일 (화)

- **GitHub `main` 추가 커밋 없음** · 구현 채팅 공백.
- 배포·모델 수치 해석 공유 구간으로 추정.

---

### 7월 22일 (수)

#### [본인] 배포 · ODsay · API 안정화 · 카카오 OAuth

| 커밋 | 내용 |
|------|------|
| `6f5d2a2` | Render Blueprint **Docker·CORS·배포 가이드** (`render.yaml`, `docs/deploy-backend-odsay.md`) |
| `37330b3` | ODsay용 **출구 IP** `/debug/egress-ip` |
| `11fdb83` | Vercel **원격 빌드** → `VITE_*` env 반영 |
| `8d4610f` | 결과 화면 **nearby·batch 폭주** 감소, API 실패 시 목업 폴백 제거 |
| `6577459` | ODsay 실패 시 가짜 경로 대신 **오류 반환** |
| `f4b83a7` | 목업 경로 `source=mock` 표시 |
| `e26ea6a` | `local-datetime` 유틸 |
| `98e96c0` / `e40ad30` | 카카오 소셜 로그인(Supabase OAuth) + 콘솔 설정 문서 |

**추가 이슈·수정 (채팅)**

- 고속터미널→원흥/연신내 **2호선 오표기** 원인 조사·수정 방향 (카카오 시각 동기 포함).
- 신림·9호선 맵/검색 범위 축소 논의 → 翌日 배포 반영.
- SMPA 당일 집회 **GitHub Actions 자동 크롤** 워크플로 설계·연동 (`.github/workflows/sync-smpa-today.yml`).

---

### 7월 23일 (목)

#### [본인] 범위·SMPA·프로덕션 UX 버그

| 커밋 | 내용 |
|------|------|
| `2f68bbf` | 경로 카드 강조 + **1~8호선** 범위 배포 |
| `c97fae2` | SMPA 집회를 **제목 행사일**로 동기화, 오늘 예보 반영 (18시 이후는 익일 수집) |
| `10268c3` | 이메일 로그인 중 카카오 버튼에 ‘이동 중’ 오표시 제거 |
| `ee79353` | 경로 결과 **슬라이더 스피너** 무한 대기 수정 |
| bot `f9e6606` 등 | SMPA 오늘의 집회 sync (+4 events) |

**추가 (채팅)**

- Render sleep / ODsay 실패 시 사용자 메시지, 정체예보 빈 화면, 지도 OD 텍스트·도착 마커·위치 아이콘 UX 정리.
- 인원 임계치(군중 통제 힌트) 상향.

---

### 7월 24일 (금)

#### [본인] 예측 원인 UI · 홈 주변역 실모델

| 커밋 | 내용 |
|------|------|
| `6b4bae1` | 경로·카카오맵에 혼잡 **예측 원인** (출발/도착·역 카드) |
| `fe47e25` | 경로 상세 `31% 혼잡 (원인)` 형식 |
| `3daa773` | 카카오맵 역 카드 혼잡% 옆 원인 표시 |
| `723c514` | 홈 주변역 혼잡 — 목업 대신 **실모델 batch** |
| `3168faa` | 홈 주변역 **대략 열차 혼잡** 표시 제거 |

**히스토리 정리 (코드 변경 없음)**

- `85fa2f7` / `245adc2`: `KakaoMap2`·`KAKAOMAP`(이태연)을 **`merge -s ours`** 로 main에 연결 → 작업 트리 유지, GitHub Contributors에 `leetaeyeon11111` 반영.

---

## 3. GitHub 타임라인 (3주차)

```
7/20  1d2074b  카카오맵 ↔ 노선도 탭 실제지도
7/20  97a7f67  [팀원] KakaoMap2 (이후 ours로 main 연결)
7/20  4383617  고도화 모델·Supabase·지도 UI
7/20  64e4fc2  혼잡 % 이벤트 베이스라인 문서

7/22  6f5d2a2~e26ea6a  Render·egress·Vercel·API·ODsay 오류 처리
7/22  98e96c0  카카오 OAuth

7/23  2f68bbf  1~8호선·카드 강조
7/23  c97fae2  SMPA 제목 행사일 동기화
7/23  10268c3 / ee79353  로그인·슬라이더 UX
7/23  Actions  SMPA sync

7/24  6b4bae1~3168faa  예측 원인 UI · 홈 batch · 열차혼잡 제거
7/24  85fa2f7 / 245adc2  이태연 브랜치 히스토리 ours 연결
```

---

## 4. 문제점 / 개선

| 문제 | 원인 | 대응 |
|------|------|------|
| 혼잡도 절대 % 이상 | 이벤트·행사가 역별 평균(베이스라인) 오염 | 문서화, AI팀 보정 대기; UI에 **원인** 병기 |
| 로그인 환경마다 실패 | 팀원 로컬 MySQL | Supabase Auth·favorites + 카카오 OAuth |
| 프로덕션 경로 탐색 | ODsay 키·IP·백엔드 | Render Docker + egress IP + Vercel `VITE_API_BASE_URL` |
| nearby/batch 폭주 | 결과 화면 중복 요청 | 호출 축소, 실패 시 mock 폴백 제거 |
| 슬라이더 무한 스피너 | 요청 상태 미해제 | `ee79353` |
| Contributors에 이태연 미표시 | 기능만 재커밋, 브랜치 미머지 | `merge -s ours` (트리 유지) |

---

## 5. 차기

- AI팀 이벤트 보정 모델 교체 후 혼잡 % 재검증
- Render 상시·ODsay LAB IP 등록 상태 점검
- SMPA 누락 집회(예: 특정 장소·인원) 필터/수집 로직 점검
- 접근성(스크린리더) 등 웹표준 (2주차 이월)

---

## HWP/노션 복붙용 짧은 버전

### 세부수행내용
```
카카오맵을 노선도 탭(노선도|실제지도)에 통합, 고도화 혼잡 모델·Supabase 인증 반영, Render/Docker·ODsay·Vercel 배포 안정화, SMPA 집회 자동 동기화·1~8호선 범위·경로 UX 버그 수정, 혼잡 예측 원인 UI 및 홈 주변역 실모델 batch 적용
```

### 본인 핵심 성과
```
• 7/20: 카카오맵↔노선도 토글(1d2074b), 팀원 MapScreen 병합, Supabase·advanced 모델(4383617), 혼잡 왜곡 문서(64e4fc2)
• 7/22: Render Docker·egress IP·Vercel 원격 빌드, nearby/batch·ODsay 오류 처리, 카카오 OAuth
• 7/23: 1~8호선·카드 강조, SMPA 제목행사일·Actions sync, 로그인/슬라이더 UX
• 7/24: 예측 원인 UI, 홈 주변역 실모델 batch, 대략 열차혼잡 제거 / 이태연 히스토리 ours 연결
```
