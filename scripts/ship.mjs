#!/usr/bin/env node
/**
 * 목업 수정 후 릴리스: build → commit → push (배포는 GitHub Actions)
 * Usage: npm run ship -- "한글 커밋 메시지"
 */
import { execSync, spawnSync } from "node:child_process";

const message = process.argv.slice(2).join(" ").trim();

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", encoding: "utf8", ...opts });
}

function runCapture(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

if (!message) {
  console.error("사용법: npm run ship -- \"커밋 메시지 (한글)\"");
  process.exit(1);
}

console.log("▶ 1/3 빌드 검증 (npm run build)");
run("npm run build");

const status = runCapture("git status --porcelain");
if (!status) {
  console.log("▶ 변경사항 없음 — 커밋 건너뜀");
} else {
  console.log("▶ 2/3 커밋");
  run("git add -A");
  const commit = spawnSync("git", ["commit", "-m", message], { stdio: "inherit" });
  if (commit.status !== 0) {
    console.error("커밋 실패");
    process.exit(commit.status ?? 1);
  }
}

console.log("▶ 3/3 GitHub push");
run("git push origin HEAD");

console.log("▶ GitHub Actions가 Vercel 프로덕션 배포를 실행합니다.");
console.log("   https://github.com/davidmh0203/SUBWAY-PREDICT/actions");
console.log("\n✅ push 완료 — 배포 완료 후: https://subway-predict-dashboard.vercel.app");
