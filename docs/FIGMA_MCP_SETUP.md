# Talk to Figma MCP — 여유로 설정 가이드

이 프로젝트를 Figma로 옮기기 위해 [Talk to Figma MCP](https://github.com/grab/cursor-talk-to-figma-mcp)를 사용합니다.

## 사전 준비 (이미 완료된 항목)

| 항목 | 경로 / 상태 |
|------|-------------|
| Bun | `~/.bun/bin/bun` |
| MCP 레포 | `/Users/iminhyeong/Projects/cursor-talk-to-figma-mcp` |
| Cursor MCP 설정 | `~/.cursor/mcp.json` → `TalkToFigma` 추가됨 |
| Export 패키지 | `figma-export/` (PDF, PNG, SVG, 토큰) |

## 1. WebSocket 서버 실행

터미널에서 **항상 켜 두세요** (Figma ↔ Cursor 중계):

```bash
cd /Users/iminhyeong/Projects/cursor-talk-to-figma-mcp
~/.bun/bin/bun socket
```

기본 포트: **3055**

## 2. Cursor MCP 재시작

`~/.cursor/mcp.json`을 수정했으므로:

1. **Cursor Settings** → **MCP** → `TalkToFigma` 서버가 보이는지 확인
2. 안 보이면 Cursor **완전 재시작** (Quit 후 다시 실행)
3. `TalkToFigma` 옆 상태가 **초록(연결됨)** 인지 확인

## 3. Figma 플러그인 설치 및 연결

1. Figma에서 새 **Design** 파일을 엽니다.
2. 플러그인 설치: [Cursor Talk to Figma MCP Plugin](https://www.figma.com/community/plugin/1485687494525374295/cursor-talk-to-figma-mcp-plugin)
3. **Plugins** → **Cursor Talk to Figma MCP** 실행
4. WebSocket 주소: `ws://localhost:3055` (기본값)
5. **채널 이름** 입력 후 Join — 플러그인에 표시된 채널 ID 사용 (예: `4g7s3qhs`)
6. Cursor 채팅에 **같은 채널 이름**을 알려주세요:
   > "채널 4g7s3qhs 연결했어. Figma에 프로토타입 올려줘"

## 4. 에이전트가 Figma에 만드는 것

MCP로 연결되면 에이전트가 다음을 생성합니다:

```
여유로 (부모 Frame)
├── 01 홈      (390 × 844)
├── 02 경로    (390 × 844)
├── 03 상세    (390 × 844)
└── 04 노선도  (390 × 844)
```

- `design-tokens.json`의 색상을 Frame 배경·라벨에 반영
- 화면 **스크린샷 PNG는 MCP로 직접 import 불가** → 아래 보조 방법 사용

## 5. 화면 이미지 넣기 (보조)

MCP는 구조·프레임·색상·텍스트 생성에 강하고, **PNG/PDF 일괄 업로드는 지원하지 않습니다.**

| 방법 | 파일 |
|------|------|
| PDF 한 번에 | `figma-export/yeoyuro-prototype.pdf` → Figma에 드래그 |
| PNG 개별 | `figma-export/screens/*.png` → 각 Frame에 드래그 |
| html.to.design | `figma-export/preview-gallery.html` + `npx serve figma-export -p 3456` |

**권장 워크플로:** MCP로 Frame 구조 생성 → PDF/PNG를 각 Frame에 맞춰 배치

## 6. 재생성 export

```bash
cd /Users/iminhyeong/Projects/subway-predict-dashboard
npm run export-figma:all
```

## 문제 해결

| 증상 | 해결 |
|------|------|
| MCP 도구가 안 보임 | Cursor 재시작, `TalkToFigma` MCP 로그 확인 |
| Figma 플러그인 연결 실패 | `bun socket` 실행 중인지 확인, 포트 3055 |
| join_channel 실패 | Figma·Cursor **채널 이름 동일**한지 확인 |
| Bun 명령 없음 | `export PATH="$HOME/.bun/bin:$PATH"` |

## 관련 문서

- [FIGMA_IMPORT.md](../figma-export/FIGMA_IMPORT.md) — PDF/PNG import
- [Talk to Figma 공식 문서](https://grab-cursor-talk-to-figma-mcp.mintlify.app/quickstart)
