#!/usr/bin/env node
/**
 * Filter metro ntce notices into crowding / protest / special-event related rows.
 *
 * Input:  data/metro-ntce/ntce-notices.csv
 * Output: data/metro-ntce/ntce-crowd-events.csv
 *
 * Usage:
 *   node scripts/filter-metro-ntce-events.mjs
 *   node scripts/filter-metro-ntce-events.mjs --input data/metro-ntce/ntce-notices.csv
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT = path.join(ROOT, "data", "metro-ntce", "ntce-notices.csv");
const OUT_DIR = path.join(ROOT, "data", "metro-ntce");
const OUT_CSV = path.join(OUT_DIR, "ntce-crowd-events.csv");
const OUT_META = path.join(OUT_DIR, "ntce-crowd-events.meta.json");

/** Tag rules: first matching tags are collected; row kept if any tag matches. */
const TAG_RULES = [
  {
    tag: "protest",
    // 시위·집회·전장연 등 — 운행/혼잡에 직접 영향
    test: (t) =>
      /시위|전장연|장애인\s*단체|특정장애인|집회|민주노총|노동자대회/.test(t),
  },
  {
    tag: "nonstop",
    test: (t, row) =>
      String(row.nonstop_yn || "").toUpperCase() === "Y" ||
      /무정차/.test(t),
  },
  {
    tag: "special_event",
    test: (t) =>
      /불꽃|축제|공연|콘서트|BTS|타종|마라톤|레이스|봄꽃|국군의\s*날|한강불빛|드론|월드컵|올림픽|페스티벌|행사\s*안내|행사\s*관련/.test(
        t,
      ) &&
      // drop pure R/H 연장 that only says 안내
      !/^1~8호선\s*출근\s*혼잡/.test(t),
  },
  {
    tag: "crowd_ops",
    // 혼잡시간 연장·러시아워 — 혼잡 %가 아니라 운영 대응 공지
    test: (t) =>
      /혼잡시간|R\s*\/\s*H|러시아워|연장\s*운행|출근시간\s*.*연장|퇴근.*연장/.test(
        t,
      ),
  },
  {
    tag: "strike",
    test: (t) => /파업|준법투쟁|버스업계|시내버스/.test(t),
  },
];

const TAG_PRIORITY = [
  "protest",
  "special_event",
  "strike",
  "nonstop",
  "crowd_ops",
];

const TAG_LABELS = {
  protest: "시위·집회",
  nonstop: "무정차",
  special_event: "특별행사",
  crowd_ops: "혼잡시간_운영대응",
  strike: "파업·준법투쟁",
};

function parseArgs(argv) {
  const opts = { input: DEFAULT_INPUT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input") opts.input = path.resolve(argv[++i]);
  }
  return opts;
}

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  function readRow() {
    const fields = [];
    let field = "";
    let inQuotes = false;
    while (i < len) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (ch === ",") {
        fields.push(field);
        field = "";
        i += 1;
        continue;
      }
      if (ch === "\n") {
        i += 1;
        fields.push(field);
        return fields;
      }
      if (ch === "\r") {
        i += 1;
        if (text[i] === "\n") i += 1;
        fields.push(field);
        return fields;
      }
      field += ch;
      i += 1;
    }
    if (field.length || fields.length) {
      fields.push(field);
      return fields;
    }
    return null;
  }

  const header = readRow();
  if (!header) return [];
  while (i < len) {
    const fields = readRow();
    if (!fields) break;
    if (fields.length === 1 && fields[0] === "") continue;
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = fields[c] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function classify(row) {
  const text = `${row.noft_ttl || ""} ${row.noft_cn || ""}`;
  const tags = [];
  for (const rule of TAG_RULES) {
    if (rule.test(text, row)) tags.push(rule.tag);
  }
  // Drop org-name-only 「서울교통공사」 noise if somehow only matched via 공사 elsewhere — we don't tag 공사.
  const primary =
    TAG_PRIORITY.find((t) => tags.includes(t)) || tags[0] || "";
  let crowd_relevance = "";
  if (tags.includes("protest") || tags.includes("special_event")) {
    crowd_relevance = tags.includes("nonstop") ? "high" : "medium";
  } else if (tags.includes("strike") || tags.includes("crowd_ops")) {
    crowd_relevance = "medium";
  } else if (tags.includes("nonstop")) {
    crowd_relevance = "medium";
  }
  return { tags, primary, crowd_relevance };
}

function keywordFlags(row) {
  const t = `${row.noft_ttl || ""} ${row.noft_cn || ""}`;
  return {
    has_protest_kw: /시위|전장연|장애인|집회/.test(t) ? "true" : "false",
    has_nonstop_kw: /무정차/.test(t) ? "true" : "false",
    has_event_kw: /축제|공연|불꽃|콘서트|BTS|타종|마라톤/.test(t)
      ? "true"
      : "false",
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!existsSync(opts.input)) {
    console.error(`Input not found: ${opts.input}`);
    console.error("Run: npm run crawl:metro-ntce");
    process.exit(1);
  }

  const raw = await readFile(opts.input, "utf8");
  const all = parseCsv(raw);
  const outRows = [];
  const tagCounts = {};

  for (const row of all) {
    const { tags, primary, crowd_relevance } = classify(row);
    if (tags.length === 0) continue;
    for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
    const flags = keywordFlags(row);
    outRows.push({
      ...row,
      event_tags: tags.join(";"),
      primary_tag: primary,
      primary_tag_ko: TAG_LABELS[primary] || primary,
      crowd_relevance,
      ...flags,
    });
  }

  outRows.sort((a, b) =>
    String(a.noft_ocrn_dt).localeCompare(String(b.noft_ocrn_dt)),
  );

  const baseCols = Object.keys(all[0] || {});
  const extraCols = [
    "event_tags",
    "primary_tag",
    "primary_tag_ko",
    "crowd_relevance",
    "has_protest_kw",
    "has_nonstop_kw",
    "has_event_kw",
  ];
  const cols = [...baseCols, ...extraCols];
  const csv =
    `\uFEFF${[
      cols.join(","),
      ...outRows.map((r) => cols.map((c) => csvEscape(r[c])).join(",")),
    ].join("\n")}\n`;

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_CSV, csv);

  const byYear = {};
  const byPrimary = {};
  const byRelevance = {};
  for (const r of outRows) {
    const y = String(r.noft_ocrn_dt).slice(0, 4) || "?";
    byYear[y] = (byYear[y] || 0) + 1;
    byPrimary[r.primary_tag] = (byPrimary[r.primary_tag] || 0) + 1;
    byRelevance[r.crowd_relevance] =
      (byRelevance[r.crowd_relevance] || 0) + 1;
  }

  const meta = {
    filtered_at: new Date().toISOString(),
    input: path.relative(ROOT, opts.input),
    source_rows: all.length,
    kept_rows: outRows.length,
    tag_counts: tagCounts,
    primary_tag_counts: byPrimary,
    crowd_relevance_counts: byRelevance,
    by_year: byYear,
    rules: TAG_RULES.map((r) => r.tag),
    output: path.relative(ROOT, OUT_CSV),
    note: "혼잡도 % 수치가 아니라 운행·시위·행사 알림. crowd_ops는 R/H 연장 등 운영 공지.",
  };
  await writeFile(OUT_META, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(JSON.stringify(meta, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
