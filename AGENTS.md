# SUBWAY PREDICT — Agent 가이드

## 목업 개발 워크플로

```
요구사항(자유 메모) → docs/requirements-*.md 정리
                  → docs/implementation-plan-*.md 플랜
                  → Phase별 구현 (코드)
                  → npm run ship (또는 릴리스 요청)
```

| 단계 | 담당 | 산출물 |
|------|------|--------|
| 요구사항 전달 | 사용자 | 화면별 bullet 메모 |
| 요구사항 정리 | Agent (일반 모델) | `docs/requirements-frontend.md` |
| 플랜 | Agent (Plan/Thinking) | `docs/implementation-plan-frontend.md` |
| 구현 | Agent (Composer) | `src/` 변경 |
| 릴리스 | Agent 또는 `npm run ship` | Git push + Vercel |

## 구현 시

- 플랜 문서 Phase 단위로 작업: `@docs/implementation-plan-frontend.md Phase N만`
- Phase마다 `npm run build` 통과 확인
- 범위 밖 파일 수정 금지

## 릴리스 시

사용자가 배포·푸시를 요청하면 `.cursor/rules/mockup-release.mdc` 절차를 따른다.

```bash
npm run ship -- "변경 요약 한글 커밋 메시지"
```

내부 동작: `build` → `commit` → `push` → GitHub Actions Deploy

## GitHub push 후

- **CI**: `.github/workflows/ci.yml` — main push/PR 시 빌드 검증
- **Deploy**: `.github/workflows/deploy.yml` — main push 시 Vercel 프로덕션 자동 배포
- Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (저장소에 등록됨)

## 주요 명령

| 명령 | 용도 |
|------|------|
| `npm run dev` | 로컬 개발 |
| `npm run build` | 프로덕션 빌드 |
| `npm run deploy` | 빌드 + Vercel CLI 배포 |
| `npm run ship` | 빌드 + 커밋 + push + 배포 |

## 데모 URL

https://subway-predict-dashboard.vercel.app
