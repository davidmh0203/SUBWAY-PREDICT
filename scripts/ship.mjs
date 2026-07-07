#!/usr/bin/env node
/**
 * 목업 수정 후 릴리스: build → commit → push → Vercel 배포
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

console.log("▶ 1/4 빌드 검증 (npm run build)");
run("npm run build");

const status = runCapture("git status --porcelain");
if (!status) {
  console.log("▶ 변경사항 없음 — 커밋 건너뜀");
} else {
  console.log("▶ 2/4 커밋");
  run("git add -A");
  const commit = spawnSync("git", ["commit", "-m", message], { stdio: "inherit" });
  if (commit.status !== 0) {
    console.error("커밋 실패");
    process.exit(commit.status ?? 1);
  }
}

console.log("▶ 3/4 GitHub push");
run("git push origin HEAD");

console.log("▶ 4/4 Vercel 프로덕션 배포");
run("npx vercel --prod --yes");

console.log("\n✅ 완료: https://subway-predict-dashboard.vercel.app");
