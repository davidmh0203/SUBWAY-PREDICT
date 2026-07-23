#!/usr/bin/env node
/**
 * Sync SMPA 「오늘의 집회/시위」(인원 포함 게시판만)
 * into data/spatic/assem-events.csv — for local ops and GitHub Actions cron.
 *
 * 핵심: 게시글 **작성일(전날)** 이 아니라 **제목의 행사일(YYMMDD)** 로 매칭한다.
 *   예) 작성 2026-07-22 / 제목 「오늘의 집회 260723 목」 → event_date=2026-07-23
 *
 * 수집 시각 (옵션 미지정 시, 공무원 퇴근 18:00 KST 기준):
 *   - 18:00 전  → 오늘 제목일(당일 일정, 전날 저녁 게시분)
 *   - 18:00 이후 → 내일 제목일(다음날 일정, 퇴근 후 게시분)
 * SPATIC(인원 없음)은 수집하지 않음.
 *
 * Usage:
 *   node scripts/sync-smpa-today.mjs
 *   node scripts/sync-smpa-today.mjs --date 2026-07-23 --lookahead 0
 *   node scripts/sync-smpa-today.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_HEADERS,
  assembliesToEventRows,
  detailUrl,
  eventDateFromTitle,
  extractTextFromHwp,
  extractTextViaPdftotext,
  extractTextViaTesseract,
  hasStructuredHtmlBody,
  htmlToPlainText,
  listUrl,
  parseAttachments,
  parseListHtml,
  parsePersonnelCount,
  pickBestAttachment,
  resolveSmpaEventDate,
  sleep,
} from "./lib/smpa-assem.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "spatic", "raw", "smpa");
const DETAILS_DIR = path.join(RAW_DIR, "details");
const HTML_DIR = path.join(RAW_DIR, "html");
const ATT_DIR = path.join(RAW_DIR, "attachments");
const OUT_EVENTS = path.join(ROOT, "data", "spatic", "assem-events.csv");
const OUT_POSTS = path.join(ROOT, "data", "spatic", "assem-posts.csv");
const REPORT = path.join(ROOT, "data", "spatic", "smpa-today-sync-report.json");

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

/** Asia/Seoul calendar date + clock (via UTC+9 shift). */
function kstParts(d = new Date()) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return {
    date: kst.toISOString().slice(0, 10),
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
  };
}

function todayKstIso(d = new Date()) {
  return kstParts(d).date;
}

/** 공무원 퇴근 이후 — 다음날 「오늘의 집회」 게시 확인 시각. */
const AFTER_HOURS_POST_HOUR = 18;

function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** `2026.7.23` / `2026-07-23` → YYYY-MM-DD */
function normalizeEventDate(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})$/);
  if (!m) return s;
  const y = m[1];
  const mo = String(Number(m[2])).padStart(2, "0");
  const d = String(Number(m[3])).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/**
 * KST 시각 기준 기본 수집 창.
 * 18시 이후 → 다음날 / 18시 전 → 당일.
 */
function defaultDateWindow(now = new Date()) {
  const { date, hour } = kstParts(now);
  if (hour >= AFTER_HOURS_POST_HOUR) {
    return {
      date: addDays(date, 1),
      lookahead: 0,
      lookback: 0,
      mode: "next-day-after-hours",
      kstHour: hour,
    };
  }
  return {
    date,
    lookahead: 0,
    lookback: 0,
    mode: "same-day",
    kstHour: hour,
  };
}

function parseArgs(argv) {
  const auto = defaultDateWindow();
  const opts = {
    date: auto.date,
    lookahead: auto.lookahead,
    lookback: auto.lookback,
    mode: auto.mode,
    kstHour: auto.kstHour,
    delay: 100,
    maxPages: 3,
    dryRun: false,
    force: true,
    dateExplicit: false,
    lookaheadExplicit: false,
    lookbackExplicit: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--date") {
      opts.date = argv[++i];
      opts.dateExplicit = true;
    } else if (a === "--lookahead") {
      opts.lookahead = Number(argv[++i]);
      opts.lookaheadExplicit = true;
    } else if (a === "--lookback") {
      opts.lookback = Number(argv[++i]);
      opts.lookbackExplicit = true;
    } else if (a === "--delay") opts.delay = Number(argv[++i]);
    else if (a === "--max-pages") opts.maxPages = Number(argv[++i]);
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--no-force") opts.force = false;
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/sync-smpa-today.mjs [options]
  --date YYYY-MM-DD   anchor date (default: KST 18시 전=오늘, 이후=내일)
  --lookahead N       also sync date+1 … date+N (default 0)
  --lookback N        also sync date-N … date-1 (default 0)
  --delay ms          request pause (default 100)
  --max-pages N       list pages to scan (default 3)
  --dry-run           crawl/parse but do not write CSV
  --no-force          reuse cached detail extracts`);
      process.exit(0);
    }
  }
  // CLI로 날짜만 준 경우에도 기본은 해당일만 (lookahead/lookback 0 유지)
  if (opts.dateExplicit && !opts.mode.startsWith("manual")) {
    opts.mode = "manual-date";
  }
  return opts;
}

function dateWindow(opts) {
  const set = new Set();
  for (let i = -opts.lookback; i <= opts.lookahead; i++) {
    set.add(addDays(opts.date, i));
  }
  return [...set].sort();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function fetchBinary(url) {
  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function ensureDirs() {
  for (const d of [RAW_DIR, DETAILS_DIR, HTML_DIR, ATT_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

function safeFilename(name) {
  return String(name).replace(/[^\w.\uac00-\ud7a3()-]+/g, "_").slice(0, 120);
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

async function crawlRecentList(opts, windowDates) {
  const kept = [];
  const seen = new Set();
  const windowSet = new Set(windowDates);
  const minDate = windowDates[0];

  for (let page = 1; page <= opts.maxPages; page++) {
    const html = await fetchText(listUrl(page));
    const items = parseListHtml(html);
    console.log(`  list page ${page}: ${items.length} posts`);
    if (!items.length) break;

    let anyInOrAfterWindow = false;
    for (const it of items) {
      // 작성일(postDate)이 아니라 제목 YYMMDD(행사일)로만 창 매칭
      const eventDate = eventDateFromTitle(it.title) || "";
      if (eventDate && eventDate >= minDate) anyInOrAfterWindow = true;
      if (!eventDate || !windowSet.has(eventDate)) continue;
      if (seen.has(it.boardNo)) continue;
      seen.add(it.boardNo);
      kept.push({
        ...it,
        eventDate,
        page,
      });
    }

    // DESC board: stop when page is entirely older than window (제목 행사일 기준)
    const keys = items
      .map((it) => eventDateFromTitle(it.title) || "")
      .filter(Boolean);
    if (keys.length && keys.every((k) => k < minDate)) {
      console.log(`  stop: page older than ${minDate}`);
      break;
    }
    if (!anyInOrAfterWindow && page > 1) break;
    await sleep(opts.delay);
  }
  return kept;
}

async function fetchDetail(item, opts) {
  const detailPath = path.join(DETAILS_DIR, `${item.boardNo}.json`);
  const txtPath = path.join(DETAILS_DIR, `${item.boardNo}.txt`);
  if (!opts.force && fs.existsSync(detailPath) && fs.existsSync(txtPath)) {
    const meta = JSON.parse(fs.readFileSync(detailPath, "utf8"));
    const plain = fs.readFileSync(txtPath, "utf8");
    return { meta, plain, skipped: true };
  }

  const url = detailUrl(item.boardNo, item.page || 1);
  const html = await fetchText(url);
  await sleep(opts.delay);
  fs.mkdirSync(HTML_DIR, { recursive: true });
  fs.writeFileSync(path.join(HTML_DIR, `${item.boardNo}.html`), html, "utf8");

  const bodyPlain = htmlToPlainText(html);
  const attachments = parseAttachments(html);
  const structured = hasStructuredHtmlBody(bodyPlain);

  let extract = {
    source: structured ? "html" : "",
    plain: structured ? bodyPlain : "",
    attachmentPath: "",
    attachmentName: "",
  };

  if (!structured) {
    const best = pickBestAttachment(attachments);
    if (best) {
      const dir = path.join(ATT_DIR, item.boardNo);
      fs.mkdirSync(dir, { recursive: true });
      const fname = safeFilename(best.name || `file.${best.prefer}`);
      const outFile = path.join(dir, fname);
      if (!fs.existsSync(outFile) || opts.force) {
        fs.writeFileSync(outFile, await fetchBinary(best.url));
        await sleep(Math.min(opts.delay, 80));
      }
      extract.attachmentPath = outFile;
      extract.attachmentName = fname;
      const lower = fname.toLowerCase();
      if (lower.endsWith(".pdf")) {
        extract.plain = extractTextViaPdftotext(outFile);
        extract.source = "pdf";
      } else if (lower.endsWith(".hwp")) {
        extract.plain = extractTextFromHwp(outFile);
        extract.source = "hwp";
      } else if (/\.(jpe?g|png)$/.test(lower)) {
        extract.plain = extractTextViaTesseract(outFile);
        extract.source = "ocr";
      }
    }
  }

  const meta = {
    boardNo: item.boardNo,
    title: item.title,
    postDate: item.postDate,
    eventDate: resolveSmpaEventDate({
      title: item.title,
      attachments,
      plain: extract.plain || bodyPlain,
    }) || item.eventDate || eventDateFromTitle(item.title) || "",
    page: item.page || null,
    sourceUrl: url,
    crawledAt: new Date().toISOString(),
    attachments,
    extract: {
      source: extract.source,
      plainLength: (extract.plain || "").length,
      plainPath: txtPath,
      attachmentPath: extract.attachmentPath
        ? path.relative(ROOT, extract.attachmentPath)
        : "",
      attachmentName: extract.attachmentName,
    },
  };
  fs.writeFileSync(txtPath, extract.plain || "", "utf8");
  fs.writeFileSync(detailPath, `${JSON.stringify(meta, null, 2)}\n`);
  return { meta, plain: extract.plain || "", skipped: false };
}

function parseDetail(meta, plain) {
  const eventDate =
    meta.eventDate ||
    resolveSmpaEventDate({
      title: meta.title,
      attachments: meta.attachments || [],
      plain,
    }) ||
    eventDateFromTitle(meta.title) ||
    meta.postDate ||
    "";
  const source = meta.extract?.source || (plain ? "unknown" : "");
  const { assemblies, emptyReason } = assembliesToEventRows({
    boards: {
      boardNo: meta.boardNo,
      title: meta.title,
      postDate: meta.postDate,
      eventDate,
      sourceUrl: meta.sourceUrl || detailUrl(meta.boardNo),
    },
    sourcePlain: plain,
    parseSource: source === "html" ? "html" : source === "hwp" ? "hwp" : "pdf",
  });

  const withP = assemblies.filter((a) => a.personnel_raw).length;
  // Drop posts that parsed with zero personnel — not the 인원표 board/doc
  if (assemblies.length && withP === 0) {
    return {
      events: [],
      post: null,
      withP: 0,
      skippedNoPersonnel: true,
    };
  }
  const post = {
    post_id: `smpa-${meta.boardNo}`,
    post_date: meta.postDate || "",
    event_date: eventDate,
    post_title: meta.title || "",
    assembly_rows: String(assemblies.length),
    pre_march_rows: "0",
    event_rows: "0",
    personnel_known_rows: String(withP),
    extract_source: source || emptyReason || "",
    source_url: meta.sourceUrl || detailUrl(meta.boardNo),
  };

  const events = assemblies.map((a) => {
    const o = {};
    for (const c of EVENT_COLUMNS) o[c] = a[c] ?? "";
    o.event_date = eventDate;
    if (!o.personnel_count && o.personnel_raw) {
      const n = parsePersonnelCount(o.personnel_raw);
      o.personnel_count = n === "" ? "" : String(n);
    }
    return o;
  });

  return { events, post, withP, skippedNoPersonnel: false };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const windowDates = dateWindow(opts);
  ensureDirs();
  console.log("SMPA today sync", {
    mode: opts.mode,
    kstHour: opts.kstHour,
    afterHoursFrom: AFTER_HOURS_POST_HOUR,
    date: opts.date,
    window: windowDates,
    dryRun: opts.dryRun,
    force: opts.force,
  });

  console.log("Crawling recent list…");
  const posts = await crawlRecentList(opts, windowDates);
  console.log(`Matched posts in window: ${posts.length}`);
  for (const p of posts) {
    console.log(`  - ${p.boardNo} ${p.eventDate} ${p.title}`);
  }

  const newEvents = [];
  const newPosts = [];
  const stats = {
    fetched: 0,
    skippedCache: 0,
    assemblies: 0,
    withPersonnel: 0,
    empty: 0,
    skippedNoPersonnel: 0,
    errors: 0,
  };

  for (const item of posts) {
    try {
      const { meta, plain, skipped } = await fetchDetail(item, opts);
      if (skipped) stats.skippedCache += 1;
      else stats.fetched += 1;
      // Re-check window after attachment/title date resolve (작성일 아님)
      const resolvedDate = normalizeEventDate(meta.eventDate);
      if (resolvedDate) meta.eventDate = resolvedDate;
      if (meta.eventDate && !windowDates.includes(meta.eventDate)) {
        console.log(
          `  skip ${item.boardNo}: resolved ${meta.eventDate} outside window`,
        );
        continue;
      }
      const parsed = parseDetail(meta, plain);
      if (parsed.skippedNoPersonnel) {
        stats.skippedNoPersonnel += 1;
        console.log(`  skip ${item.boardNo}: no personnel (not 인원표)`);
        continue;
      }
      if (!parsed.events.length) {
        stats.empty += 1;
        if (parsed.post) newPosts.push(parsed.post);
        continue;
      }
      stats.assemblies += parsed.events.length;
      stats.withPersonnel += parsed.withP;
      newEvents.push(...parsed.events);
      newPosts.push(parsed.post);
    } catch (err) {
      stats.errors += 1;
      console.error(`  error ${item.boardNo}: ${err.message}`);
    }
  }

  // Same calendar day may get a correction post — keep newest boardNo only
  const bestPostByDate = new Map();
  for (const p of newPosts) {
    p.event_date = normalizeEventDate(p.event_date);
    const prev = bestPostByDate.get(p.event_date);
    if (!prev || String(p.post_id) > String(prev.post_id)) {
      bestPostByDate.set(p.event_date, p);
    }
  }
  const keepIds = new Set([...bestPostByDate.values()].map((p) => p.post_id));
  const dedupedPosts = newPosts.filter((p) => keepIds.has(p.post_id));
  const dedupedEvents = newEvents
    .filter((e) => keepIds.has(e.post_id))
    .map((e) => ({ ...e, event_date: normalizeEventDate(e.event_date) }));
  if (dedupedPosts.length !== newPosts.length) {
    console.log(
      `Deduped posts ${newPosts.length} → ${dedupedPosts.length} (latest per event_date)`,
    );
  }

  const existingEvents = parseExistingCsv(OUT_EVENTS);
  const existingPosts = parseExistingCsv(OUT_POSTS);
  const touchIds = new Set(dedupedPosts.map((p) => p.post_id));
  const windowSet = new Set(windowDates);

  // Keep rows outside the sync window / untouched posts; replace synced smpa posts
  const keptEvents = existingEvents.rows.filter((r) => {
    const id = String(r.post_id || "");
    const ed = normalizeEventDate(r.event_date);
    if (touchIds.has(id)) return false;
    // Also drop stale smpa rows for window dates (re-sync cleanly)
    if (id.startsWith("smpa-") && windowSet.has(ed)) return false;
    return true;
  });
  const keptPosts = existingPosts.rows.filter((r) => {
    const id = String(r.post_id || "");
    const ed = normalizeEventDate(r.event_date);
    if (touchIds.has(id)) return false;
    if (id.startsWith("smpa-") && windowSet.has(ed)) return false;
    return true;
  });

  const mergedEvents = [...keptEvents, ...dedupedEvents].map((r) => ({
    ...r,
    event_date: normalizeEventDate(r.event_date),
  }));
  mergedEvents.sort((a, b) => {
    const d = String(b.event_date).localeCompare(String(a.event_date));
    if (d) return d;
    return String(a.post_id).localeCompare(String(b.post_id));
  });
  const mergedPosts = [...keptPosts, ...dedupedPosts].map((r) => ({
    ...r,
    event_date: normalizeEventDate(r.event_date),
  }));
  mergedPosts.sort((a, b) => {
    const d = String(b.event_date).localeCompare(String(a.event_date));
    if (d) return d;
    return String(a.post_id).localeCompare(String(b.post_id));
  });

  const report = {
    finishedAt: new Date().toISOString(),
    mode: opts.mode,
    kstHour: opts.kstHour,
    afterHoursFrom: AFTER_HOURS_POST_HOUR,
    date: opts.date,
    window: windowDates,
    source: "smpa-nd54882",
    postsMatched: posts.length,
    ...stats,
    eventsWritten: dedupedEvents.length,
    totals: {
      events: mergedEvents.length,
      posts: mergedPosts.length,
    },
    samples: dedupedEvents.slice(0, 8).map((e) => ({
      post_id: e.post_id,
      event_date: e.event_date,
      time_raw: e.time_raw,
      place: (e.place_raw || "").slice(0, 50),
      personnel_raw: e.personnel_raw,
    })),
  };
  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

  if (opts.dryRun) {
    console.log("Dry-run: CSV not written");
    return;
  }

  fs.writeFileSync(OUT_EVENTS, toCsv(EVENT_COLUMNS, mergedEvents));
  fs.writeFileSync(
    OUT_POSTS,
    toCsv(
      POST_COLUMNS,
      mergedPosts.map((r) => {
        const o = {};
        for (const c of POST_COLUMNS) o[c] = r[c] ?? "";
        return o;
      }),
    ),
  );
  console.log(
    `Wrote ${path.relative(ROOT, OUT_EVENTS)} (${mergedEvents.length} rows, +${dedupedEvents.length} synced)`,
  );
  console.log(
    `Wrote ${path.relative(ROOT, OUT_POSTS)} (${mergedPosts.length} posts)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
