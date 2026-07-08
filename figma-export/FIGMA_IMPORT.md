# 여유로 → Figma 가져오기

## 방법 0 — Talk to Figma MCP (에이전트 자동 생성)

설정: [docs/FIGMA_MCP_SETUP.md](../docs/FIGMA_MCP_SETUP.md)

1. `bun socket` 실행 (WebSocket 3055)
2. Figma 플러그인 → 채널 `yeoyuro` join
3. Cursor 채팅: **"채널 yeoyuro 연결했어. Figma에 프로토타입 올려줘"**

에이전트가 `여유로` 부모 Frame + 4개 화면 Frame(390×844)을 생성합니다.  
화면 이미지는 MCP로 직접 import 불가 → 아래 PDF/PNG 보조 사용.

---

이 폴더는 프로토타입을 Figma로 옮기기 위한 export 패키지입니다.

## 포함 파일

| 파일 | 설명 |
|------|------|
| `screens/*.png` | 4개 화면 스크린샷 (390×844) |
| `metro-map.svg` | 앱 스타일 노선도 벡터 |
| `metro-map-source.svg` | 원본 수도권 노선도 SVG |
| `design-tokens.json` | 색상·타이포·컴포넌트 스펙 |
| `components/*.svg` | 역 마커 컴포넌트 |

## 방법 1 — 스크린샷으로 빠르게 (추천)

1. Figma에서 **iPhone 14** 프레임(390×844) 생성
2. `screens/` PNG 4장을 프레임에 드래그
3. 화면별로 Frame 이름: `01 홈`, `02 경로`, `03 상세`, `04 노선도`

## 방법 2 — html.to.design 플러그인 (레이어 분리)

1. 터미널: `npm run dev`
2. Figma → Plugins → **html.to.design**
3. URL 입력:
   - `http://localhost:5173/#home`
   - `http://localhost:5173/#results`
   - `http://localhost:5173/#detail`
   - `http://localhost:5173/#macro`

## 방법 3 — 노선도만 벡터로

1. `metro-map.svg`를 Figma 캔버스에 드래그
2. 레이어: lines / labels / stations 분리 편집 가능

## 디자인 토큰 적용

`design-tokens.json`의 `colors`를 Figma **Color styles**로 등록하세요.

## 재생성

```bash
npm run export-figma:all
```
