#!/usr/bin/env node
/**
 * Crawl SMPA 「오늘의 집회/시위」 board (nd54882) for years missing from
 * SPATIC assem-events.csv (default: event/post date before 2024-03-18).
 *
 * Writes resumable raw under data/spatic/raw/smpa/
 *   list.jsonl, details/{boardNo}.json, html/, attachments/
 *
 * Usage:
 *   node scripts/crawl-smpa-assem.mjs
 *   node scripts/crawl-smpa-assem.mjs --before 2024-03-18 --delay 250
 *   node scripts/crawl-smpa-assem.mjs --list-only
 *   node scripts/crawl-smpa-assem.mjs --max-posts 50
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_HEADERS,
  DATA_START,
  SPATIC_COVERAGE_START,
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
  pickBestAttachment,
  sleep,
} from "./lib/smpa-assem.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "spatic", "raw", "smpa");
const LIST_PATH = path.join(RAW_DIR, "list.jsonl");
const DETAILS_DIR = path.join(RAW_DIR, "details");
const HTML_DIR = path.join(RAW_DIR, "html");
const ATT_DIR = path.join(RAW_DIR, "attachments");
const META_PATH = path.join(RAW_DIR, "crawl-meta.json");

function parseArgs(argv) {
  const opts = {
    before: SPATIC_COVERAGE_START,
    after: DATA_START,
    delay: 80,
    concurrency: 6,
    listOnly: false,
    maxPosts: 0,
    maxPages: 0,
    startPage: 1,
    force: false,
    skipAttachments: false,
    listFile: "",
    refreshList: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--before") opts.before = argv[++i];
    else if (a === "--after") opts.after = argv[++i];
    else if (a === "--delay") opts.delay = Number(argv[++i]);
    else if (a === "--concurrency") opts.concurrency = Number(argv[++i]);
    else if (a === "--list-only") opts.listOnly = true;
    else if (a === "--max-posts") opts.maxPosts = Number(argv[++i]);
    else if (a === "--max-pages") opts.maxPages = Number(argv[++i]);
    else if (a === "--start-page") opts.startPage = Number(argv[++i]);
    else if (a === "--force") opts.force = true;
    else if (a === "--skip-attachments") opts.skipAttachments = true;
    else if (a === "--list-file") opts.listFile = argv[++i];
    else if (a === "--refresh-list") opts.refreshList = true;
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/crawl-smpa-assem.mjs [options]
  --before YYYY-MM-DD   keep posts with event_date/post_date < this (default ${SPATIC_COVERAGE_START})
  --after YYYY-MM-DD    keep posts with event_date/post_date >= this (default ${DATA_START})
  --list-file PATH      write/read list jsonl here (default data/spatic/raw/smpa/list.jsonl)
  --refresh-list        re-crawl board list even if list file exists
  --delay ms            per-request pause (default 80)
  --concurrency N       parallel detail workers (default 6)
  --list-only           inventory pages only
  --max-posts N         stop after N detail fetches
  --max-pages N         stop list crawl after N pages
  --start-page N
  --force               re-fetch details even if cached
  --skip-attachments    HTML only (no PDF/HWP/JPG download)`);
      process.exit(0);
    }
  }
  return opts;
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

function postKeyDate(item) {
  return eventDateFromTitle(item.title) || item.postDate || item.eventDate || "";
}

function shouldKeepPost(item, { before, after }) {
  const key = postKeyDate(item);
  if (!key) return true;
  if (before && !(key < before)) return false;
  if (after && key < after) return false;
  return true;
}

async function crawlList(opts, listPath) {
  const rows = [];
  let page = opts.startPage;
  let emptyStreak = 0;
  console.log(
    `List crawl from page ${page}… (after=${opts.after || "∅"} before=${opts.before || "∅"})`,
  );

  while (true) {
    if (opts.maxPages && page - opts.startPage + 1 > opts.maxPages) break;
    const html = await fetchText(listUrl(page));
    const items = parseListHtml(html);
    if (!items.length) {
      emptyStreak += 1;
      console.log(`  page ${page}: 0 items`);
      if (emptyStreak >= 2) break;
      page += 1;
      await sleep(opts.delay);
      continue;
    }
    emptyStreak = 0;
    const kept = items.filter((it) => shouldKeepPost(it, opts));
    for (const it of items) {
      rows.push({
        ...it,
        eventDate: eventDateFromTitle(it.title) || "",
        keep: shouldKeepPost(it, opts),
        page,
      });
    }
    const dates = items.map((i) => i.postDate).filter(Boolean);
    console.log(
      `  page ${page}: ${items.length} posts, keep≈${kept.length}, dates ${dates[0] || "?"}…${dates.at(-1) || "?"}`,
    );

    // Board is DESC by post date. If every item is older than --after, stop.
    if (opts.after) {
      const keys = items.map((it) => postKeyDate(it)).filter(Boolean);
      if (keys.length && keys.every((k) => k < opts.after)) {
        console.log(`  stop: page entirely before --after ${opts.after}`);
        break;
      }
    }

    page += 1;
    await sleep(opts.delay);
  }

  const keptRows = rows.filter((r) => r.keep);
  const fh = fs.createWriteStream(listPath, { encoding: "utf8" });
  for (const r of keptRows) {
    fh.write(`${JSON.stringify(r)}\n`);
  }
  fh.end();
  await new Promise((res, rej) => {
    fh.on("finish", res);
    fh.on("error", rej);
  });

  console.log(
    `Wrote ${keptRows.length} posts (of ${rows.length} listed) → ${listPath}`,
  );
  return keptRows;
}

function loadListFromDisk(listPath) {
  if (!fs.existsSync(listPath)) return null;
  return fs
    .readFileSync(listPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function safeFilename(name) {
  return String(name).replace(/[^\w.\uac00-\ud7a3()-]+/g, "_").slice(0, 120);
}

async function processOneDetail(item, opts) {
  const detailPath = path.join(DETAILS_DIR, `${item.boardNo}.json`);
  if (!opts.force && fs.existsSync(detailPath)) {
    return "skipped";
  }

  const url = detailUrl(item.boardNo, item.page || 1);
  const html = await fetchText(url);
  await sleep(opts.delay);
  const htmlPath = path.join(HTML_DIR, `${item.boardNo}.html`);
  fs.writeFileSync(htmlPath, html, "utf8");

  const plain = htmlToPlainText(html);
  const attachments = parseAttachments(html);
  const structured = hasStructuredHtmlBody(plain);

  let extract = {
    source: structured ? "html" : "",
    plain: structured ? plain : "",
    attachmentPath: "",
    attachmentName: "",
  };

  if (!structured && !opts.skipAttachments) {
    const best = pickBestAttachment(attachments);
    if (best) {
      const dir = path.join(ATT_DIR, item.boardNo);
      fs.mkdirSync(dir, { recursive: true });
      const fname = safeFilename(best.name || `file.${best.prefer}`);
      const outFile = path.join(dir, fname);
      if (!fs.existsSync(outFile) || opts.force) {
        const bin = await fetchBinary(best.url);
        fs.writeFileSync(outFile, bin);
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
      if (!extract.plain && attachments.length > 1) {
        for (const alt of attachments) {
          const al = alt.name.toLowerCase();
          if (best.name === alt.name) continue;
          const af = path.join(dir, safeFilename(alt.name));
          if (!fs.existsSync(af)) {
            try {
              fs.writeFileSync(af, await fetchBinary(alt.url));
            } catch {
              continue;
            }
          }
          if (al.endsWith(".pdf")) {
            const t = extractTextViaPdftotext(af);
            if (t) {
              extract = {
                source: "pdf",
                plain: t,
                attachmentPath: af,
                attachmentName: path.basename(af),
              };
              break;
            }
          }
          if (/\.(jpe?g|png)$/.test(al)) {
            const t = extractTextViaTesseract(af);
            if (t) {
              extract = {
                source: "ocr",
                plain: t,
                attachmentPath: af,
                attachmentName: path.basename(af),
              };
              break;
            }
          }
          if (al.endsWith(".hwp")) {
            const t = extractTextFromHwp(af);
            if (t) {
              extract = {
                source: "hwp",
                plain: t,
                attachmentPath: af,
                attachmentName: path.basename(af),
              };
              break;
            }
          }
        }
      }
    }
  }

  const record = {
    boardNo: item.boardNo,
    title: item.title,
    postDate: item.postDate,
    eventDate: item.eventDate || eventDateFromTitle(item.title) || "",
    page: item.page || null,
    sourceUrl: url,
    crawledAt: new Date().toISOString(),
    attachments,
    extract: {
      source: extract.source,
      plainLength: (extract.plain || "").length,
      plainPath: path.join(DETAILS_DIR, `${item.boardNo}.txt`),
      attachmentPath: extract.attachmentPath
        ? path.relative(ROOT, extract.attachmentPath)
        : "",
      attachmentName: extract.attachmentName,
    },
    htmlPath: path.relative(ROOT, htmlPath),
  };
  fs.writeFileSync(record.extract.plainPath, extract.plain || "", "utf8");
  fs.writeFileSync(detailPath, `${JSON.stringify(record, null, 2)}\n`);
  return "fetched";
}

async function crawlDetails(list, opts) {
  const stats = { done: 0, fetched: 0, skipped: 0, errors: 0 };
  const queue = list.slice();
  let fetchBudget = opts.maxPosts || Infinity;
  const workers = Math.max(1, opts.concurrency || 1);

  async function worker() {
    while (queue.length) {
      if (stats.fetched >= fetchBudget) return;
      const item = queue.shift();
      if (!item) return;
      try {
        const result = await processOneDetail(item, opts);
        if (result === "skipped") stats.skipped += 1;
        else {
          stats.fetched += 1;
        }
      } catch (err) {
        stats.errors += 1;
        console.error(`  error ${item.boardNo}: ${err.message}`);
        const detailPath = path.join(DETAILS_DIR, `${item.boardNo}.json`);
        fs.writeFileSync(
          detailPath,
          `${JSON.stringify({ boardNo: item.boardNo, error: String(err.message), title: item.title }, null, 2)}\n`,
        );
      }
      stats.done += 1;
      if (stats.done % 50 === 0) {
        console.log(
          `  details ${stats.done}/${list.length} (fetched ${stats.fetched}, skipped ${stats.skipped}, errors ${stats.errors})`,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  console.log(
    `  details final ${stats.done}/${list.length} (fetched ${stats.fetched}, skipped ${stats.skipped}, errors ${stats.errors})`,
  );
  return stats;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  ensureDirs();
  const listPath = opts.listFile
    ? path.resolve(ROOT, opts.listFile)
    : LIST_PATH;
  console.log("SMPA crawl", {
    after: opts.after || "",
    before: opts.before,
    listFile: path.relative(ROOT, listPath),
    delay: opts.delay,
    concurrency: opts.concurrency,
    listOnly: opts.listOnly,
  });

  let list = opts.refreshList ? null : loadListFromDisk(listPath);
  if (!list || opts.force || opts.maxPages) {
    list = await crawlList(opts, listPath);
  } else {
    console.log(`Reusing ${path.relative(ROOT, listPath)} (${list.length} posts)`);
  }

  if (opts.listOnly) {
    fs.writeFileSync(
      META_PATH,
      JSON.stringify(
        {
          finishedAt: new Date().toISOString(),
          after: opts.after || "",
          before: opts.before,
          listFile: path.relative(ROOT, listPath),
          listCount: list.length,
          listOnly: true,
        },
        null,
        2,
      ),
    );
    return;
  }

  const stats = await crawlDetails(list, opts);
  fs.writeFileSync(
    META_PATH,
    JSON.stringify(
      {
        finishedAt: new Date().toISOString(),
        after: opts.after || "",
        before: opts.before,
        listFile: path.relative(ROOT, listPath),
        listCount: list.length,
        ...stats,
      },
      null,
      2,
    ),
  );
  console.log("Done.", stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
