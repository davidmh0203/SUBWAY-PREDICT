# 릴리스 가이드 (목업 수정 → Git → 배포)

## 한 줄 요약

```bash
npm run ship -- "변경 내용을 한글로 요약한 커밋 메시지"
```

빌드 → 커밋 → `git push` → Vercel 프로덕션 배포까지 한 번에 실행합니다.

---

## 워크플로

```
1. 목업 코드 수정 (Phase별 구현)
2. npm run build 로 로컬 확인
3. npm run ship -- "커밋 메시지"
   또는 Agent에게 「깃에 올리고 배포해줘」
```

Agent는 `.cursor/rules/mockup-release.mdc` · `AGENTS.md` 절차를 따릅니다.

---

## 명령어

| 명령 | 설명 |
|------|------|
| `npm run dev` | 로컬 개발 서버 |
| `npm run build` | 빌드만 (배포 전 검증) |
| `npm run deploy` | 빌드 + Vercel CLI 배포 (Git push 없음) |
| `npm run ship` | 빌드 + 커밋 + push + 배포 |

---

## GitHub CI

`main` 브랜치 push / PR 시 GitHub Actions가 `npm run build`를 실행합니다.  
설정: `.github/workflows/ci.yml`

---

## Vercel 자동 배포 (push만으로 배포)

CLI로 Git 연동이 안 될 수 있어, **Vercel 대시보드에서 한 번만** 연결하세요.

1. [Vercel Dashboard](https://vercel.com/dashboard) → **subway-predict-dashboard** 프로젝트
2. **Settings** → **Git**
3. **Connect Git Repository** → `davidmh0203/SUBWAY-PREDICT` → **main**
4. 이후 `git push`만 해도 Vercel이 자동 빌드·배포

이미 연결된 경우 `npm run ship`의 마지막 `vercel --prod`는 중복 배포가 될 수 있습니다.  
그때는 `npm run ship` 대신:

```bash
npm run build && git add -A && git commit -m "메시지" && git push
```

만 실행해도 됩니다.

---

## 프로덕션 URL

https://subway-predict-dashboard.vercel.app
