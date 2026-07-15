#!/usr/bin/env node
/**
 * Parse SMPA raw details → append rows into data/spatic/assem-events.csv
 * (and assem-posts.csv). Adds personnel_count; maps 신고인원 → personnel_raw.
 *
 * Usage:
 *   node scripts/parse-smpa-assem.mjs
 *   node scripts/parse-smpa-assem.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assembliesToEventRows,
  detailUrl,
  eventDateFromTitle,
  parsePersonnelCount,
  DATA_START,
  SPATIC_COVERAGE_START,
} from "./lib/smpa-assem.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "spatic", "raw", "smpa");
const DETAILS_DIR = path.join(RAW_DIR, "details");
const OUT_EVENTS = path.join(ROOT, "data", "spatic", "assem-events.csv");
const OUT_POSTS = path.join(ROOT, "data", "spatic", "assem-posts.csv");
const REPORT = path.join(ROOT, "data", "spatic", "smpa-parse-report.json");

const EVENT_COLUMNS = [
  "post_id",
  "post_date",
  "event_date",
  "post_title",
  "record_type",
  "seq_no",
  "time_raw",
  "time_start",
  "time_end",
  "place_raw",
  "place_primary",
  "venue_raw",
  "march_raw",
  "march_start",
  "march_end",
  "march_waypoints",
  "is_pre_march",
  "parent_seq_no",
  "event_name",
  "personnel_raw",
  "personnel_count",
  "control_time_raw",
  "control_section_raw",
  "control_method_raw",
  "crowd_focus_points",
  "parse_ok",
  "source_url",
];

const POST_COLUMNS = [
  "post_id",
  "post_date",
  "event_date",
  "post_title",
  "assembly_rows",
  "pre_march_rows",
  "event_rows",
  "personnel_known_rows",
  "extract_source",
  "source_url",
];

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    before: SPATIC_COVERAGE_START,
    after: DATA_START,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--before") opts.before = argv[++i];
    else if (a === "--after") opts.after = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/parse-smpa-assem.mjs [--dry-run] [--after YYYY-MM-DD] [--before YYYY-MM-DD]",
      );
      process.exit(0);
    }
  }
  return opts;
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(columns, rows) {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c] ?? "")).join(","));
  }
  return `\uFEFF${lines.join("\n")}\n`;
}

function parseExistingCsv(filePath) {
  if (!fs.existsSync(filePath)) return { columns: [], rows: [] };
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return { columns: [], rows: [] };
  const columns = splitCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const obj = {};
    columns.forEach((c, j) => {
      obj[c] = cells[j] ?? "";
    });
    rows.push(obj);
  }
  return { columns, rows };
}

/** Minimal CSV line splitter supporting quotes. */
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function normalizeSpaticRow(row) {
  const out = {};
  for (const c of EVENT_COLUMNS) {
    if (c === "personnel_count") {
      if (row.personnel_count != null && row.personnel_count !== "") {
        out.personnel_count = String(row.personnel_count);
      } else {
        const n = parsePersonnelCount(row.personnel_raw || "");
        out.personnel_count = n === "" ? "" : String(n);
      }
    } else {
      out[c] = row[c] ?? "";
    }
  }
  return out;
}

function loadDetailRecords() {
  if (!fs.existsSync(DETAILS_DIR)) return [];
  return fs
    .readdirSync(DETAILS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const j = JSON.parse(
        fs.readFileSync(path.join(DETAILS_DIR, f), "utf8"),
      );
      const txtPath = path.join(DETAILS_DIR, f.replace(/\.json$/, ".txt"));
      const plain = fs.existsSync(txtPath)
        ? fs.readFileSync(txtPath, "utf8")
        : "";
      return { ...j, plain };
    })
    .filter((d) => !d.error);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const details = loadDetailRecords();
  console.log(`SMPA details: ${details.length}`);

  const eventRows = [];
  const postRows = [];
  const stats = {
    posts: 0,
    postsWithAssemblies: 0,
    assemblies: 0,
    withPersonnel: 0,
    bySource: {},
    empty: 0,
    skippedAfterCutoff: 0,
    skippedBeforeStart: 0,
  };

  for (const d of details) {
    const eventDate =
      eventDateFromTitle(d.title) || d.postDate || d.eventDate || "";
    if (eventDate && eventDate >= opts.before) {
      stats.skippedAfterCutoff += 1;
      continue;
    }
    if (opts.after && eventDate && eventDate < opts.after) {
      stats.skippedBeforeStart += 1;
      continue;
    }
    stats.posts += 1;
    const source = d.extract?.source || (d.plain ? "unknown" : "");
    stats.bySource[source || "none"] =
      (stats.bySource[source || "none"] || 0) + 1;

    const { assemblies, emptyReason } = assembliesToEventRows({
      boards: {
        boardNo: d.boardNo,
        title: d.title,
        postDate: d.postDate,
        eventDate,
        sourceUrl: d.sourceUrl || detailUrl(d.boardNo),
      },
      sourcePlain: d.plain || "",
      parseSource:
        source === "html" ? "html" : source === "hwp" ? "hwp" : "pdf",
    });

    if (!assemblies.length) {
      stats.empty += 1;
      postRows.push({
        post_id: `smpa-${d.boardNo}`,
        post_date: d.postDate || "",
        event_date: eventDate,
        post_title: d.title || "",
        assembly_rows: "0",
        pre_march_rows: "0",
        event_rows: "0",
        personnel_known_rows: "0",
        extract_source: source || emptyReason || "",
        source_url: d.sourceUrl || detailUrl(d.boardNo),
      });
      continue;
    }

    stats.postsWithAssemblies += 1;
    stats.assemblies += assemblies.length;
    const withP = assemblies.filter((a) => a.personnel_raw).length;
    stats.withPersonnel += withP;
    eventRows.push(...assemblies);
    postRows.push({
      post_id: `smpa-${d.boardNo}`,
      post_date: d.postDate || "",
      event_date: eventDate,
      post_title: d.title || "",
      assembly_rows: String(assemblies.length),
      pre_march_rows: "0",
      event_rows: "0",
      personnel_known_rows: String(withP),
      extract_source: source,
      source_url: d.sourceUrl || detailUrl(d.boardNo),
    });
  }

  const existingEvents = parseExistingCsv(OUT_EVENTS);
  const existingPosts = parseExistingCsv(OUT_POSTS);

  // Keep non-SMPA rows (≥ after); replace prior smpa-* rows on re-parse
  const keptEvents = existingEvents.rows
    .filter((r) => !String(r.post_id || "").startsWith("smpa-"))
    .filter((r) => !opts.after || (r.event_date || "") >= opts.after)
    .map(normalizeSpaticRow);
  const keptPosts = existingPosts.rows
    .filter((r) => !String(r.post_id || "").startsWith("smpa-"))
    .filter((r) => !opts.after || (r.event_date || "") >= opts.after);

  // Align posts schema (add new cols if missing)
  const mergedPosts = [
    ...keptPosts.map((r) => {
      const o = {};
      for (const c of POST_COLUMNS) o[c] = r[c] ?? "";
      return o;
    }),
    ...postRows,
  ];
  const mergedEvents = [...keptEvents, ...eventRows];

  // Sort: SPATIC-ish by event_date desc then post_id
  mergedEvents.sort((a, b) => {
    const d = String(b.event_date).localeCompare(String(a.event_date));
    if (d) return d;
    return String(a.post_id).localeCompare(String(b.post_id));
  });

  const report = {
    finishedAt: new Date().toISOString(),
    before: opts.before,
    smpa: stats,
    totals: {
      events: mergedEvents.length,
      posts: mergedPosts.length,
      smpaEvents: eventRows.length,
      spaticEvents: keptEvents.length,
    },
    outputs: {
      events: path.relative(ROOT, OUT_EVENTS),
      posts: path.relative(ROOT, OUT_POSTS),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (opts.dryRun) {
    console.log("Dry run — not writing CSV");
    return;
  }

  fs.writeFileSync(OUT_EVENTS, toCsv(EVENT_COLUMNS, mergedEvents));
  fs.writeFileSync(OUT_POSTS, toCsv(POST_COLUMNS, mergedPosts));
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${OUT_EVENTS} (${mergedEvents.length} rows)`);
  console.log(`Wrote ${OUT_POSTS} (${mergedPosts.length} rows)`);
}

main();
