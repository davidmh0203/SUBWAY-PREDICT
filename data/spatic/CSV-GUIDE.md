# SPATIC 집회·행사 CSV 가이드 (팀원용)

서울경찰청 교통정보센터 [집회·통제정보](https://www.spatic.go.kr/spatic/main/assem.do)에서 수집·정리한 데이터입니다.  
**목적:** “어디에서 시위·행사가 열리고, 사람들이 어디에 몰릴 후보인가”를 분석·모델·서비스에 붙이기 위한 flat 테이블.

| 항목 | 내용 |
|------|------|
| 주 파일 | [`assem-events.csv`](./assem-events.csv) (UTF-8 BOM, Excel에서 한글 깨짐 적음) |
| 보조 | [`assem-posts.csv`](./assem-posts.csv) 게시글 단위 요약 |
| 기간 | **2020-01-01 ~** (SMPA 2020–2024-03 gap + SPATIC 2024-03-18~) |
| 규모(최근 생성 기준) | 게시글 ~2,376건 → 이벤트 행 ~12,605건 |
| 인코딩 | UTF-8 (BOM) |
| 갱신 | `npm run parse:spatic-assem` (원문 있으면) / 전체 `npm run spatic-assem` |
| 앱 연동 | FastAPI `GET /forecast/cards`가 **DB 없이** 이 CSV를 메모리 로드. 갱신 후 커밋·백엔드 재배포. Postgres 등 불필요. |

---

## 1. 데이터가 어떻게 만들어졌나

```text
SPATIC 웹 게시판
  → POST /assem/getList.json  (목록+본문 HTML, Playwright 불필요)
  → 제목 필터: 「행사 및 집회」만 유지 / 「도로공사」·테스트 제외
  → raw/assem.jsonl
  → 파서 (표·라벨 분리)
  → assem-events.csv
```

원문은 한글(HWP) 웹에디터 HTML이라 **화면에서는 표가 깨져 보이기도** 하지만, 복사·HTML 텍스트는 살아 있습니다. 파서는 스크린샷이 아니라 `assemConts` HTML → 텍스트로 읽습니다.

### 한 행의 의미

| `record_type` | 의미 | 대략 비중 |
|---------------|------|-----------|
| `assembly` | 본문 「□ 집 회」표의 **본집회 1건** (연번 1, 2, 3…) | 대다수 |
| `pre_march` | 표 안 **【사전 집회·행진】** 하위 블록 1건 | 소수 |
| `event` | 본문 「□ 행 사」블록 1건 (마라톤·축제 등) | 소수 |

같은 날짜 게시글에 집회 여러 건 + 행사 여러 건이 있으면 **행이 여러 줄**로 펼쳐집니다.

---

## 2. 정리(클리닝) 포인트

원문이 한 줄에 섞여 있는 경우가 많아, 아래처럼 **컬럼별로 떼어 넣었습니다.**

| 섞여 나오던 예 | 정리 후 |
|----------------|---------|
| `26.6.7.(일) 07:30~11:00 ※ 교통통제: 07:00~11:00 -인 원: 총 10,000명…` | `time_raw` = 일자·시간만 / `control_time_raw` = 통제 시간 / `personnel_raw` = 인원 |
| `『마라톤A』 … 『마라톤B』` 가 한 블록 | `『』`·`[]` 제목 단위로 **행사 행 분리** |
| `※행진: A→B→C` | `march_start` / `march_waypoints` / `march_end` |
| `place`에 인원·다음 행사 제목이 붙음 | 코스·장소만 남기고 제거 |

`parse_ok=false` 이면 자동 분리가 애매한 행입니다. 원문은 `source_url` 또는 raw JSONL로 확인하세요.

---

## 3. 파일별 역할

| 파일 | 언제 쓰나 |
|------|-----------|
| **assem-events.csv** | 분석·피처·대시보드의 **기본 테이블** (권장) |
| assem-posts.csv | “하루에 집회가 몇 건 공지됐나” 게시글 단위 집계 |
| parse-report.json | 파싱 성공률·타입별 건수 점검 |
| raw/assem.jsonl | 재파싱·감사용 (용량 큼, gitignore) |

---

## 4. `assem-events.csv` 컬럼 사전

### 4.1 게시글·일정

| 컬럼 | 타입/예 | 의미 |
|------|---------|------|
| `post_id` | `2005` | SPATIC 게시글 ID (`mgrSeq`) |
| `post_date` | `2026-07-13` | 게시글 작성일 (서버 `lastMdfyDat`) |
| `event_date` | `2026-07-13` | **실제 집회·행사 예정일** (제목 `7월 13일` + 연도). 분석 시 날짜 키로 **이것 우선** |
| `post_title` | `7월 13일 (월) 행사 및 집회` | 게시글 제목 |
| `source_url` | URL | 원문 상세 페이지 |

### 4.2 행 종류

| 컬럼 | 값 | 의미 |
|------|-----|------|
| `record_type` | `assembly` / `pre_march` / `event` | 위 §1 표 참고 |
| `seq_no` | `1`, `2`… | 집회 표 연번. 행사·사전집회는 보통 빈칸 |
| `is_pre_march` | `true` / `false` | 사전 집회·행진 여부 (`pre_march`와 동일 취지) |
| `parent_seq_no` | `1` | 사전집회가 딸린 **본집회 연번** |
| `parse_ok` | `true` / `false` | 장소·시간 등 핵심 필드 추출 성공 여부 |

### 4.3 시간

| 컬럼 | 예 | 의미 |
|------|-----|------|
| `time_raw` | `①08:40∼09:00 ②15:00∼16:00` 또는 `26.6.7.(일) 07:30~11:00` | 시간 원문(정리 후). **인원·통제 문구는 여기 없음** |
| `time_start` | `08:40` | 첫 구간 시작 `HH:MM` |
| `time_end` | `09:00` | 첫 구간 종료. `13:00∼`처럼 끝 없으면 빈칸 |

> 집회 칸에 ①② 두 타임이 있으면 `time_raw`에 둘 다 남고, `time_start`/`time_end`는 **첫 구간**만 넣습니다.

### 4.4 장소·행진 (혼잡 분석 핵심)

| 컬럼 | 예 | 의미 |
|------|-----|------|
| `place_raw` | `시의회 앞(인도)` / 코스 전체 | 장소·코스 원문 |
| `place_primary` | `시의회 앞(인도)` | 주 집결지 (화살표 `→`가 있으면 **첫 지점**) |
| `venue_raw` | `잠수교북단~남단 달빛광장` | 행사 「-장소:」 전용 (집회는 보통 빈칸) |
| `march_raw` | `※행진:A→B→C …` | 행진 원문 |
| `march_start` | `동화면세점` | 행진 **출발** |
| `march_end` | `사랑채 동측 건너편` | 행진 **도착** (왕복이면 출발과 같을 수 있음) |
| `march_waypoints` | `광화문\|세종대로사거리` | 중간 경유, `\|` 구분 |
| **`crowd_focus_points`** | `시의회 앞;강남역;신논현역` | **사람들이 몰릴 후보 지점**을 `;`로 묶은 리스트 (`place_primary` + 행진 경로 토큰). 역 매핑 전 1차 키 |

### 4.5 행사 전용

| 컬럼 | 예 | 의미 |
|------|-----|------|
| `event_name` | `2026 서울시 쉬엄쉬엄 모닝` | `[…]` / `『…』` 행사명 |
| `personnel_raw` | `총 10,000명(하프 3,000명, …)` / `500명` | 인원 원문. SPATIC 행사 글·SMPA **신고인원** 공통 컬럼. SPATIC 일반 집회 HTML에는 거의 없어, 같은 날짜 SMPA 첨부와 시간·출발지·행진 경로로 매칭해 채움(`npm run fill:assem-personnel`). SMPA 원문 파싱 커버리지 ~98% |
| `personnel_count` | `10000` / `500` | `personnel_raw`에서 뽑은 숫자(가능 시). 신고·예상 인원 피처용 |

SMPA 보완 행은 `post_id`가 `smpa-{boardNo}` 형태이며 `source_url`이 smpa.go.kr 로 구분됩니다 (`event_date` < 2024-03-18).

| `control_time_raw` | `05:00~10:00(5h)` | **교통통제 시간** (행사 진행 시간과 다를 수 있음) |
| `control_section_raw` | `공원1문~마포대교 북단` | 통제 구간 |
| `control_method_raw` | `양방향 전면통제` | 통제 방식 |

집회(`assembly`) 행에서는 위 행사 컬럼이 대부분 비어 있습니다.

---

## 5. 어떤 컬럼을 쓰면 되나 (빠른 가이드)

| 하고 싶은 일 | 추천 컬럼 |
|--------------|-----------|
| 날짜별 집회 목록 | `event_date` + `record_type` + `place_primary` |
| 시작·끝에서 역 혼잡 가설 | `crowd_focus_points` 또는 `march_start` / `march_end` / `place_primary` |
| 시간대 피처 | `time_start`, `time_end` (+ 필요 시 `control_time_raw`) |
| 대규모 행사만 | `record_type=event` + `personnel_raw` / `personnel_count` |
| 신고·예상 인원 (SMPA 집회 포함) | `personnel_raw` (원문) + `personnel_count` (숫자) |
| 원문 확인 | `source_url` |
| 품질 필터 | `parse_ok=true` |

---

## 6. 샘플 행

### 집회 (`assembly`)

| 필드 | 값 |
|------|-----|
| event_date | 2026-07-13 |
| record_type | assembly |
| seq_no | 1 |
| time_raw | ①08:40∼09:00 ②15:00∼16:00 |
| place_primary | 시의회 앞(인도) |
| crowd_focus_points | 시의회 앞(인도) |

### 사전 집회·행진 (`pre_march`)

| 필드 | 값 |
|------|-----|
| record_type | pre_march |
| parent_seq_no | 1 |
| march_start → end | 사랑채 동측 건너편 → 동화면세점 |
| crowd_focus_points | 사랑채…;광화문;세종대로사거리;동화면세점 |

### 행사 (`event`)

| 필드 | 값 |
|------|-----|
| event_name | 2026 마인드 마라톤 |
| time_raw | 26.6.7.(일) 07:30~11:00 |
| personnel_raw | 총 10,000명(…) |
| control_time_raw | 07:00 ~ 11:00(4시간) |
| place_raw | 서울시청→…→무교동사거리→시청 |

---

## 7. 한계·주의

1. **2024-03-18 이전 없음** — SPATIC 보드 한계. 2021년분은 이 CSV에 없음.  
2. **도로공사 미포함** — 의도적으로 제외.  
3. **좌표·역코드 없음** — `crowd_focus_points`는 지명 문자열. 지하철역 매핑은 후속 작업.  
4. **표기 비통일** — `시의회 앞` vs `시의회앞`, `∼` vs `~` 등이 섞여 있음. 집계 전 정규화 권장.  
5. **노이즈** — 드물게 `crowd_focus_points`에 경로 설명 조각이 남을 수 있음 → `parse_ok`·수동 샘플 확인.  
6. **서울 시내 도로 기준 공지** — 전국·타 시도 집회는 범위 밖.  
7. 이 CSV와 **서울교통공사 지하철 알림 API**(무정차·시위 운행공지)는 역할이 다름:  
   - SPATIC = **거리** 집회·행사 예고  
   - 메트로 알림 = **지하철 운행** 이례  
   → 보완 관계 (자세한 비교: [`docs/implementation-plan-seoul-metro-ntce.md`](../../docs/implementation-plan-seoul-metro-ntce.md))

---

## 8. 재생성 명령

```bash
# 크롤 + 파싱
npm run spatic-assem

# 이미 raw 있을 때 CSV만 다시
npm run parse:spatic-assem
```

구현·수집 상세: [`docs/implementation-plan-spatic-assem-crawl.md`](../../docs/implementation-plan-spatic-assem-crawl.md)

문의 시 `post_id` + `source_url`을 같이 주시면 원문 대조가 빠릅니다.
