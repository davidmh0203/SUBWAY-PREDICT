# 서울교통공사 지하철 알림 (ntce)

공공데이터포털 `B553766/ntce` `getNtceList` 수집본.

## 파일 안내

| 파일 | 용도 | 건수(현재) |
|------|------|------------|
| [`ntce-notices.csv`](./ntce-notices.csv) | **전체** 알림 (2020-01-01~) | 1,076 |
| [`ntce-crowd-events.csv`](./ntce-crowd-events.csv) | **시위·무정차·특별행사·혼잡운영**만 필터 | **833** |
| `*.meta.json` | 건수·태그 분포 | — |

혼잡·이벤트 분석에는 **`ntce-crowd-events.csv`** 를 쓰는 것을 권장합니다.

앱 홈「오늘의 정체 예보」는 당일 돌발을 **ntce 라이브 API**로 우선 조회하고, 실패 시 이 CSV의당일 행을 폴백합니다 (`GET /forecast/cards`). DB 적재 없이 레포 `data/` + FastAPI 메모리 로드입니다.

## 재생성

`.env`에 `TRAIN_ALERT_API_DECOIND_KEY`(우선) 또는 `TRAIN_ALERT_API_KEY` 필요.

```bash
npm run metro-ntce
# 또는 단계별
npm run crawl:metro-ntce
npm run filter:metro-ntce-events
```

---

## `ntce-crowd-events.csv` (필터본)

전체 알림 중 아래 태그가 **하나라도** 해당하면 포함합니다.

| `event_tags` / `primary_tag` | 의미 | 매칭 예 |
|------------------------------|------|---------|
| `protest` | 시위·집회 | 시위, 전장연, 집회, 민주노총… |
| `nonstop` | 무정차 | `nonstop_yn=Y` 또는 본문에 무정차 |
| `special_event` | 특별행사 | 불꽃축제, 공연, BTS, 타종, 봄꽃축제… |
| `crowd_ops` | 혼잡시간 **운영** 대응 | R/H·러시아워 연장운행 (혼잡 **수치** 아님) |
| `strike` | 파업·준법투쟁 | 시내버스 파업 등 지하철 영향 공지 |

추가 컬럼:

| 컬럼 | 의미 |
|------|------|
| `event_tags` | 해당 태그 전부 `;` 구분 (복수 가능) |
| `primary_tag` | 대표 태그 (우선순위: protest → special_event → strike → nonstop → crowd_ops) |
| `primary_tag_ko` | 한글 라벨 |
| `crowd_relevance` | `high` (시위/행사+무정차 등) / `medium` |
| `has_protest_kw` / `has_nonstop_kw` / `has_event_kw` | 키워드 플래그 |

### 현재 필터 스냅샷

| primary | 건수 |
|---------|------|
| protest | 656 |
| nonstop (시위 외) | 104 |
| strike | 31 |
| special_event | 27 |
| crowd_ops | 15 |
| **합계** | **833** |

- 시위+무정차 동시: ~309건  
- `crowd_relevance=high`: ~328건  

### 주의

- **역 혼잡도 % API가 아닙니다.** 운행·시위·행사 **알림 텍스트**입니다.
- `crowd_ops`는 출근 혼잡시간 연장 같은 **스케줄 공지**입니다.
- 「서울교통공사」기관명만 있는 공사 알림은 의도적으로 제외했습니다.
- 거리 집회 예고(SPATIC)와 보완 관계: [`../spatic/CSV-GUIDE.md`](../spatic/CSV-GUIDE.md)

---

## 전체본 (`ntce-notices.csv`) 컬럼

| 컬럼 | 의미 |
|------|------|
| `noft_ocrn_dt` | 알림 발생 시각 |
| `noft_se_cd` / `noft_se_nm` | 구분코드 1~8 (화재…임시시간표) |
| `noft_ttl` / `noft_cn` | 제목 / 본문 |
| `nonstop_yn` | 무정차 Y/N |
| `line_nm_lst` | 호선 |
| `stn_sctn_cd_lst` | 역·구간 코드 (비는 경우 많음) |
| `xcse_sitn_bgng_dt` / `xcse_sitn_end_dt` | 이례상황 시작·종료 |

관련 플랜: [`docs/implementation-plan-seoul-metro-ntce.md`](../../docs/implementation-plan-seoul-metro-ntce.md)
