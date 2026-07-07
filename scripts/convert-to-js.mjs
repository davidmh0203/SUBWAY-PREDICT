#!/usr/bin/env node
/**
 * TS/TSX → JS/JSX 일괄 변환 (esbuild 타입 제거)
 * - components → .jsx
 * - lib, main, App → .js / .jsx
 * - types.ts 는 삭제 (런타임 코드 없음)
 */
import { execSync } from "node:child_process";
import { readdirSync, statSync, unlinkSync, existsSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";

const SRC = new URL("../src", import.meta.url).pathname;
const SKIP = new Set(["types.ts"]);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (/\.tsx?$/.test(entry) && !SKIP.has(entry)) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(SRC);
const converted = [];

for (const file of files) {
  const rel = relative(SRC, file);
  const isComponent =
    rel.startsWith("components/") ||
    rel === "App.tsx" ||
    rel === "main.tsx";
  const outExt = isComponent ? ".jsx" : ".js";
  const outFile = file.replace(/\.tsx?$/, outExt);

  const loader = file.endsWith(".tsx") ? "tsx" : "ts";
  const jsxOpt = isComponent ? "--jsx=preserve" : "";
  execSync(
    `npx esbuild "${file}" --bundle=false --charset=utf8 --loader:.${loader}=${loader} --format=esm ${jsxOpt} --outfile="${outFile}"`.replace(/\s+/g, " ").trim(),
    { stdio: "pipe" },
  );

  unlinkSync(file);
  converted.push({ from: rel, to: relative(SRC, outFile) });
}

// types.ts 삭제
const typesFile = join(SRC, "types.ts");
if (existsSync(typesFile)) {
  unlinkSync(typesFile);
  converted.push({ from: "types.ts", to: "(deleted)" });
}

console.log(`Converted ${converted.length} files:`);
for (const { from, to } of converted) {
  console.log(`  ${from} → ${to}`);
}
