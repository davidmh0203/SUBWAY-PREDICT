# SPATIC 집회·행사 데이터

서울경찰청 교통정보센터 [집회·통제정보](https://www.spatic.go.kr/spatic/main/assem.do)에서 수집한 행사/집회 CSV.

**팀원용 데이터 사전·컬럼 설명 → [`CSV-GUIDE.md`](./CSV-GUIDE.md)** (먼저 읽기)

## 한계

- 보드 실데이터는 대략 **2024-03-18 ~** 부터 존재합니다. 2021년분까지는 이 사이트에 없습니다.
- `서울시내도로공사` 게시글은 수집하지 않습니다.
- 웹 UI는 목록을 AJAX로 늦게 로드하고 위치권한을 요청하지만, 크롤러는 `POST /assem/getList.json`만 사용합니다 (Playwright/geolocation 불필요).

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
