# 릴리스 가이드 (목업 수정 → Git → 배포)

## 한 줄 요약

```bash
npm run ship -- "변경 내용을 한글로 요약한 커밋 메시지"
```

빌드 → 커밋 → `git push` 후 **GitHub Actions**가 Vercel 프로덕션에 자동 배포합니다.

---

## 워크플로

```
1. 목업 코드 수정 (Phase별 구현)
2. npm run build 로 로컬 확인
3. npm run ship -- "커밋 메시지"
   또는 Agent에게 「깃에 올리고 배포해줘」
4. GitHub Actions 완료 확인
   https://github.com/davidmh0203/SUBWAY-PREDICT/actions
```

---

## 명령어

| 명령 | 설명 |
|------|------|
| `npm run dev` | 로컬 개발 서버 |
| `npm run build` | 빌드만 (배포 전 검증) |
| `npm run deploy` | 로컬에서 빌드 + Vercel CLI 직접 배포 |
| `npm run ship` | 빌드 + 커밋 + push → **Actions 자동 배포** |

---

## 자동 배포 (설정 완료)

| 항목 | 상태 |
|------|------|
| GitHub Actions `deploy.yml` | `main` push 시 Vercel 프로덕션 배포 |
| GitHub Actions `ci.yml` | `main` push/PR 시 빌드 검증 |
| Secrets | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |

배포 진행: [Actions 탭](https://github.com/davidmh0203/SUBWAY-PREDICT/actions)

---

## (선택) Vercel 대시보드 Git 연동

CLI `vercel git connect`는 GitHub App 미설치 시 실패할 수 있습니다.  
대시보드 연동을 원하면:

1. [GitHub Vercel App 설치](https://github.com/apps/vercel/installations/new)
2. [Vercel 프로젝트 Git 설정](https://vercel.com/davidmh0203s-projects/subway-predict-dashboard/settings/git)

이미 GitHub Actions로 배포되므로 **필수는 아닙니다**.

---

## 프로덕션 URL

https://subway-predict-dashboard.vercel.app
