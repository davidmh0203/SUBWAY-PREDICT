/**
 * 회귀: seoulOnly 필터가 공식색 세그먼트에서 1~8호선을 모두 남기는지 검증.
 *
 * 재현(버그): SVG_HEX_TO_LINE_KEY만 쓰면 공식색(#00A84D 등)이 키로 안 잡혀
 * 6호선(#CD7C2F)만 남음.
 *
 * Run: node scripts/verify-seoul-line-filter.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SVG_HEX_TO_LINE_KEY,
  lineKeyForSvgHex,
} from "../src/lib/station-line-colors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const segments = JSON.parse(
  readFileSync(join(root, "src/lib/generated/metro-line-segments.json"), "utf8"),
);

const SEOUL_LINE_PATTERN = /^[1-8]호선/;

function keySvgOnly(color) {
  return SVG_HEX_TO_LINE_KEY[color.toLowerCase()] ?? color.toLowerCase();
}

function summarize(getKey) {
  const lines = new Map();
  let kept = 0;
  for (const seg of segments) {
    const key = getKey(seg.color);
    if (!SEOUL_LINE_PATTERN.test(key)) continue;
    kept += 1;
    lines.set(key, (lines.get(key) ?? 0) + 1);
  }
  return { kept, lines: [...lines.keys()].sort((a, b) => a.localeCompare(b, "ko")) };
}

const buggy = summarize(keySvgOnly);
const fixed = summarize(lineKeyForSvgHex);

console.log("segments", segments.length);
console.log("BUG svg-only →", buggy.kept, "segs, lines:", buggy.lines.join(", ") || "(none)");
console.log("FIX hex map →", fixed.kept, "segs, lines:", fixed.lines.join(", ") || "(none)");

const expected = ["1호선", "2호선", "3호선", "4호선", "5호선", "6호선", "7호선", "8호선"];
const missing = expected.filter((k) => !fixed.lines.includes(k));

if (buggy.lines.length <= 1) {
  console.log("repro ok: svg-only collapses to", buggy.lines.join(", ") || "nothing");
} else {
  console.warn("warn: expected svg-only mode to collapse; got", buggy.lines);
}

if (missing.length || fixed.kept < 100) {
  console.error("FAIL: seoulOnly must keep all 1~8 lines. missing:", missing.join(", ") || "(n/a)");
  process.exit(1);
}

console.log("PASS: official-color segments resolve to all 1~8 lines under seoulOnly");
