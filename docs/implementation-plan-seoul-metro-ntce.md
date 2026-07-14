# 서울교통공사 지하철알림정보(ntce) — 적합성 테스트 플랜

| 항목 | 내용 |
|------|------|
| API | [서울교통공사_지하철알림정보](https://www.data.go.kr/data/15144070/openapi.do) (`B553766/ntce`) |
| 운영 | `GET /getNtceList` · `dataType=JSON` |
| 작성일 | 2026-07-13 |
| 상태 | **플랜 + 읽기 전용 라이브 프로브 완료** — 프로덕션 연동·UI 미포함 |
| Auth env | **우선** `TRAIN_ALERT_API_DECOIND_KEY` (Decoding) → **폴백** `TRAIN_ALERT_API_KEY` (Encoding) |
| 관련 | SPATIC 집회 크롤([implementation-plan-spatic-assem-crawl.md](./implementation-plan-spatic-assem-crawl.md)) · mock 혼잡(`crowd-data.js`, `mock-data.js` `TODAY_EVENTS`) |

---

## 1. Goal & Non-goals

### Goal

**읽기 전용 프로브**로 알림 컬럼·텍스트가 여유로 제품 질문에 답할 만큼 풍부한지 판정한다.

| 제품 질문 | 확인 포인트 |
|-----------|-------------|
| 시위·집회로 인한 **무정차** | `nonstopYn` + 제목/본문(`시위|집회|전장연|무정차`) |
| **혼잡** (“사람 너무 많음”) | 본문 키워드 · `noftSeCd` 5/6 비중 |
| **공사** | 키워드 · 시설장애(4) vs 기타(6) |
| 예고/비예고 집회(전장연 등) | 신고 집회(SPATIC)와 **별개**로, 운행 공지에만 잡히는지 |

판정 후보: **실시간 배너** / **모델 피처(후속)** / **무시**.

### Non-goals

- 앱·백엔드 프로덕션 연동, 폴링 워커, UI
- SPATIC 크롤 대체·병합 구현
- mock `TODAY_EVENTS` / congestion 파이프라인 교체
- serviceKey를 레포·커밋·문서 예시에 하드코딩

---

## 2. Env 설정 (키 커밋 금지)

```bash
# .env (gitignore) — 둘 다 둘 수 있음. 프로브는 Decoding 우선.
TRAIN_ALERT_API_DECOIND_KEY='(포털 Decoding 키 — + / = 포함 가능)'
TRAIN_ALERT_API_KEY='(포털 Encoding 키 — %xx 형태)'
```

| 주의 | 내용 |
|------|------|
| 변수명 철자 | Decoding 쪽은 **`TRAIN_ALERT_API_DECOIND_KEY`** (DECO**I**ND). `DECODE`로 “고치지” 말 것 — `.env`·스크립트·문서가 이 철자에 맞춰져 있음 |
| 우선순위 | **1)** Decoding (`DECOIND`)을 `URLSearchParams`로 한 번 encode · **2)** 실패 시 Encoding (`TRAIN_ALERT_API_KEY`)을 query에 **raw append** (재인코딩 금지) |
| Decoding | `+` `/` `=` 문자가 있어 query builder encode가 안정적 |
| Encoding | 이미 URL-encoded. `encodeURIComponent`로 **이중 인코딩하면** `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` 등 실패 |
| 커밋 | `.env*`, 스크립트 기본값, 로그·CSV·플랜에 **어느 키도** 포함 금지 |
| HTTPS | `https://apis.data.go.kr/B553766/ntce/getNtceList` |

---

## 3. 프로브 스크립트 (`scripts/probe-metro-ntce.mjs`)

```bash
node scripts/probe-metro-ntce.mjs
```

```text
GET https://apis.data.go.kr/B553766/ntce/getNtceList
  ?serviceKey=<DECOIND preferred | Encoding fallback>
  &dataType=JSON
  &pageNo=1&numOfRows=100
  &srchStartNoftOcrnYmd=YYYYMMDD
  &srchEndNoftOcrnYmd=YYYYMMDD
  &selectFields=...
```

| 단계 | 동작 |
|------|------|
| 1 | `TRAIN_ALERT_API_DECOIND_KEY` 스모크 → 실패 시 `TRAIN_ALERT_API_KEY` |
| 2 | 최근 7일 · 30일 윈도우 페이지네이션 |
| 3 | 샘플 → `tmp/ntce-sample.json`, 요약 → `tmp/ntce-probe-summary.json` (`tmp/` gitignore, 키 미포함) |
| 4 | stdout: auth mode, totalCount, `noftSeCd` 분포, 키워드 hit(`서울교통공사` strip), `nonstopYn` |

---

## 4. 필드 인벤토리 (프로브로 확정)

요청 `selectFields`에 `lineNm`,`stnCd`를 넣어도 **응답 키는 아래 이름**이다.

| 응답 필드 | 실측 | 용도 |
|-----------|------|------|
| `noftSeCd` | ✅ | 시위/공사/혼잡 **전용 코드 없음** — 시위·무정차는 대개 **6(기타)** |
| `noftTtl` / `noftCn` | ✅ | 자유 텍스트 단서 |
| `nonstopYn` | ✅ `Y`/`N` | 무정차 여부 — 시위·이벤트 공지와 강하게 동반 |
| `upbdnbSe` | △ 종종 null | 상·하행; 무정차 건에서만 채워지는 경우 있음 |
| `xcseSitnBgngDt` / `xcseSitnEndDt` | △ | 시작/종료 — 한쪽만 있는 행 흔함 |
| `lineNmLst` | ✅ (요청 `lineNm` 아님) | `"3호선"`, `"5호선, 6호선, 공항철도"` |
| `stnSctnCdLst` | ✅ (요청 `stnCd` 아님) | 콤마 코드 리스트; **시위 사전안내에선 null 많음** |
| `noftOcrnDt` | ✅ | 알림 발생 시각 |
| `crtrYmd` | ✅ | 기준일 |

**`noftSeCd`**: 1화재 … 8임시시간표. 시위·공사·혼잡·무정차는 **텍스트 + `nonstopYn`** 이 핵심.

---

## 5. 키워드·필터 실험 (실측 요약)

기간 필터 `srchStartNoftOcrnYmd`~`End` = `20240101`~`20260713`, `noftTtl` 서버 검색, `numOfRows=10` (2026-07-13 프로브).

| `noftTtl` 키워드 | totalCount | 비고 |
|------------------|------------|------|
| 시위 | **90** | 거의 전부「특정장애인단체 시위」사전/진행; `nonstopYn=Y`, `noftSeCd=6` |
| 집회 | **0** | 제목 검색어로 부적합 — 본문 post-filter 또는「시위」사용 |
| 무정차 | **75** | 시설·시위·공연 혼재; 역 코드 채워진 비율 높음 |
| 혼잡 | **15** | 대부분 **출근 혼잡시간(R/H) 연장운행** 공지 — 실시간 역 혼잡 수치가 아님 |
| 공사 | **13** | 「서울교통**공사**」기관명 false positive + 실제 철거공사 |
| 전장연 | **3** | 시청·혜화 등 명시 건 존재 (`noftSeCd=6`) |

추가 월 샘플: 2025-02에 공덕 무정차 + 「특정장애인단체 시위」사전/진행; 2024-12 종각·여의도 무정차; 2026-05 서소문 고가 철거; 날짜 없음 전체 **totalCount≈1281**(테스트 메시지 포함).

---

## 6. 제품 결정 매핑

| 프로브 결과 | 권장 |
|-------------|------|
| 시위·무정차·전장연이 제목/본문·`nonstopYn`으로 반복 재현 | **Realtime banner** — 1순위 (경로·홈 이벤트에 운행 이례 부착) |
| 동일 사건이 호선·시간창으로 묶임; 역 코드는 부분적 | **Model feature(후속)** — 호선·시간 uplift 후보; 역 정밀 매핑은 `stnSctnCdLst` null 시 텍스트 파싱 필요 |
| 「혼잡」키워드 | **수치 혼잡 모델 입력으로는 부적합** (스케줄 연장 공지 위주) → `crowd-data` 대체 금지 |
| 「공사」키워드 | 기관명 노이즈 필터 후 배너 후보; 코드 4(시설장애)와 AND 권장 |
| 「집회」제목 검색 | ignore — 「시위」·`전장연`·`특정장애인` 사용 |

**잠정 결론:** 제품용으로 **무시하지 않음**. SPATIC(거리 예고)과 보완하여 **운행 실시간 이벤트 소스**로 적합. 혼잡 % 소스로는 부적합.

현재 목업 `TODAY_EVENTS` / `trigger`와 붙일 때는 `METRO_NTCE` 같은 별도 trigger를 두고 mock KOPIS와 분리.

---

## 7. SPATIC 크롤 대비

| | SPATIC 집회 보드 | 서울메트로 ntce |
|--|------------------|-----------------|
| 성격 | 신고·게시 **거리 집회·행사** | **지하철 운행** 공지(지연·무정차·시위 영향) |
| 시점 | 사전 일정 중심 | 사전안내 + 진행/종료 (예: 시위 사전→진행) |
| 장소 | 도로·광장·행진 | `lineNmLst` / `stnSctnCdLst`(부분) / 무정차 |
| 시위 라벨 | 제목·본문 명시 | 전용 코드 없음; 「시위」「전장연」「특정장애인단체」 |
| 비예고(전장연 등) | 보드에 없을 수 있음 | **운행 공지에 잡힘** (실측 3건+) |
| 공사 | 도로공사 글 혼재 | 철거·시설 + 「서울교통공사」노이즈 |
| 이번 Phase | CSV 구조화 | **적합 테스트 + 스모크 프로브** |
| 제품 역할 | 혼잡 **예측 피처**(역 근접) | **실시간 운행 이벤트** (+ 가능 시 호선·시간 피처) |

→ **보완 관계**. 한쪽이 다른 쪽을 대체하지 않음.

---

## 8. 성공 기준 — 심플 테스트 Done

| # | 기준 | 결과 |
|---|------|------|
| 1 | Decoding(`DECOIND`) 우선 또는 Encoding 폴백으로 JSON + `resultCode=00` | ✅ |
| 2 | 응답 스키마·키명 확정 (`lineNmLst`, `stnSctnCdLst` 등) | ✅ §4 |
| 3 | 샘플 기간 `noftSeCd` 분포 | ✅ 시위/무정차 중심은 **6** 위주; 시설장애 **4**, 임시시간표 **8** 소수 |
| 4 | 키워드별 hit + 샘플 | ✅ §5 |
| 5 | 제품 한 줄 결론 | ✅ **Realtime banner 1순위 / 혼잡 수치 모델은 ignore / SPATIC과 보완** |
| 6 | SPATIC과 역할 비중복 | ✅ §7 |

---

## 9. Risks

| 리스크 | 완화 |
|--------|------|
| Encoding 키 이중 인코딩 | Decoding 우선; Encoding은 raw append |
| `DECOIND` → `DECODE`로 오수정 | 철자는 **DECOIND** 고정 — README/플랜에 명시 |
| 넓은 날짜·연속 호출 시 **HTTP 403** | 월 단위·sleep·결과 `tmp/` 캐시 |
| 시위 전용 코드 없음 | `noftTtl`∋시위 + `nonstopYn` + `noftSeCd=6` |
| 「공사」「집회」검색 품질 | 공사=기관명 FP; 집회=0 → 시위/전장연 사용 |
| `stnSctnCdLst` null | 시위 사전안내는 호선만 — 역 매핑 약함 |
| 관할 범위 | 서울교통공사 중심 공지; 타 운영사·공항철도 언급은 환승 맥락으로 섞일 수 있음 |
| 테스트/잡음 메시지 | nodate 응답에 우이신설선 테스트 문구 — 프로덕션 필터 필요 |
| 키 유출 | env only; 문서·커밋에 키 금지 |

---

## 10. Findings (라이브 스모크, 2026-07-13)

- Auth: **`TRAIN_ALERT_API_DECOIND_KEY`(Decoding) 우선**, 실패 시 `TRAIN_ALERT_API_KEY`(Encoding) 폴백. 둘 다 `.env`에 존재; 프로브는 사용한 env명·mode만 로그(키 값 미출력).
- 재프로브(2026-07-13): Decoding 스모크 **http=200 `resultCode=00`** — Encoding 폴백 불필요.
- 철자: env는 **`DECOIND`**(DECODE 아님). 오타처럼 보여도 `.env`와 맞추기 위해 유지.
- 최근 7일은 **0건**인 창이 있음; 월 단위·키워드·날짜 없음으로 데이터 확인.
- **시위·무정차·전장연은 충분히 존재**(§5) → 여유로 **운행 이례 배너**에 붙일 가치 있음.
- 「특정장애인단체」가 시위 공지의 지배적 표현; 「전장연」은 소수지만 명시.
- 혼잡도 API가 아님: 「혼잡」= R/H 연장 등 운영 공지.
- `noftSeCd`에 시위 전용 코드 없음(1화재…8임시시간표).

---

## 11. 다음 단계 (구현 시, 별도 Phase)

1. ☑ `scripts/probe-metro-ntce.mjs` — Decoding(`DECOIND`) 우선 + Encoding 폴백
2. 시위/무정차 정규화 스키마: `{ lines[], stationCodes[], nonstop, start, end, title, category }`
3. (선택) 실시간 배너 mock → 라이브 어댑터 스파이크
4. 모델 피처는 SPATIC CSV와 조인 실험 후에만

**하지 않음(이번):** 앱 프로덕션 연동, 시크릿 커밋, SPATIC 파이프라인 변경.
