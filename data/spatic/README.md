# SPATIC 집회·행사 데이터

서울경찰청 교통정보센터 [집회·통제정보](https://www.spatic.go.kr/spatic/main/assem.do)에서 수집한 행사/집회 CSV.

**팀원용 데이터 사전·컬럼 설명 → [`CSV-GUIDE.md`](./CSV-GUIDE.md)** (먼저 읽기)

## 한계

- SPATIC 보드 실데이터는 대략 **2024-03-18 ~** 부터 존재합니다. 그 이전은 아래 SMPA 보완 수집을 씁니다.
- `서울시내도로공사` 게시글은 수집하지 않습니다.
- 웹 UI는 목록을 AJAX로 늦게 로드하고 위치권한을 요청하지만, 크롤러는 `POST /assem/getList.json`만 사용합니다 (Playwright/geolocation 불필요).

## SMPA 보완 (2020-01-01 ~ 2024-03-17 gap)

서울경찰청 [오늘의 집회/시위](https://www.smpa.go.kr/user/nd54882.do) 게시판에서 **SPATIC 이전** 일자를 채웁니다. 분석 창은 **2020-01-01부터**입니다. 첨부(PDF 우선, HWP/JPG 보조)에서 **신고인원**을 `personnel_raw` / `personnel_count`로 저장합니다. 레거시 `집회 … 인원 관할서` 표·2020년대 다단 PDF 레이아웃 모두 파싱하며, 원문에 인원이 있으면 행 단위로 반영합니다.

```bash
npm run smpa-assem
# 또는
npm run crawl:smpa-assem   # data/spatic/raw/smpa/ (gitignore)
npm run parse:smpa-assem   # assem-events.csv 에 smpa-* 행 append
```

기본 범위: `--after 2020-01-01 --before 2024-03-18`. 재실행 시 동일 `smpa-*` 행을 교체합니다.
SPATIC 기간(2024-03-18~)의 빈 `personnel_*`는 같은 날짜 SMPA 첨부 집회와 **시간·출발지·행진 경로**로 매칭해 채웁니다.  
SPATIC에 없고 SMPA에만 있는 집회(인원 있음)는 `smpa-*` 행으로 **추가**합니다.

```bash
npm run crawl:smpa-overlap          # SPATIC 기간 SMPA 첨부 수집
npm run fill:assem-personnel       # 빈 인원 채움 + SMPA-only 행 insert
```

## 재생성

```bash
npm run spatic-assem
# 또는
npm run crawl:spatic-assem
npm run parse:spatic-assem
```

| 파일 | 설명 |
|------|------|
| [`CSV-GUIDE.md`](./CSV-GUIDE.md) | 컬럼 의미·정리 방식·사용 가이드 |
| `raw/assem.jsonl` | 원문 HTML 포함 (gitignore) |
| `assem-events.csv` | 집회/사전집회/행사 flat 행 (**분석용 본체**) |
| `assem-posts.csv` | 게시글 단위 요약 |
| `parse-report.json` | 파싱 커버리지 |
