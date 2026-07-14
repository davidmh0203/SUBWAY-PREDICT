#!/usr/bin/env node
/**
 * Crawl SPATIC 집회·통제정보 via POST /assem/getList.json (no Playwright).
 * Geolocation prompts on the website are map-only and ignored here.
 *
 * Usage:
 *   node scripts/crawl-spatic-assem.mjs
 *   node scripts/crawl-spatic-assem.mjs --limit 50 --delay 300
 *   node scripts/crawl-spatic-assem.mjs --fresh
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DETAIL_URL,
  fetchAssemList,
  formatPostDate,
  isAssemblyPostTitle,
  sleep,
} from "./lib/spatic-assem.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "spatic", "raw");
const OUT_FILE = path.join(OUT_DIR, "assem.jsonl");
const META_FILE = path.join(OUT_DIR, "assem-meta.json");

function parseArgs(argv) {
  const opts = {
    limit: 20,
    delay: 350,
    fresh: false,
    maxPages: Infinity,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fresh") opts.fresh = true;
    else if (a === "--limit") opts.limit = Number(argv[++i]);
    else if (a === "--delay") opts.delay = Number(argv[++i]);
    else if (a === "--max-pages") opts.maxPages = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/crawl-spatic-assem.mjs [options]
  --limit N       page size (default 20)
  --delay MS      pause between pages (default 350)
  --max-pages N   stop after N pages (debug)
  --fresh         ignore existing JSONL and rewrite`);
      process.exit(0);
    }
  }
  return opts;
}

function loadExistingIds(file) {
  const ids = new Set();
  if (!fs.existsSync(file)) return ids;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.mgrSeq != null) ids.add(String(row.mgrSeq));
    } catch {
      /* skip bad line */
    }
  }
  return ids;
}

function slimRecord(item) {
  return {
    mgrSeq: String(item.mgrSeq),
    assemTitle: item.assemTitle || "",
    lastMdfyDat: item.lastMdfyDat || "",
    post_date: formatPostDate(item.lastMdfyDat),
    readCount: item.readCount ?? null,
    docType: item.docType ?? null,
    atchFileNm: item.atchFileNm ?? null,
    assemConts: item.assemConts || "",
    source_url: DETAIL_URL(item.mgrSeq),
    crawled_at: new Date().toISOString(),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (opts.fresh && fs.existsSync(OUT_FILE)) {
    fs.unlinkSync(OUT_FILE);
  }

  const existing = opts.fresh ? new Set() : loadExistingIds(OUT_FILE);
  const writeStream = fs.createWriteStream(OUT_FILE, { flags: "a" });

  let offset = 0;
  let totalCount = null;
  let pages = 0;
  let fetched = 0;
  let kept = 0;
  let skippedExisting = 0;
  let skippedFilter = 0;

  console.log(
    `Crawling SPATIC assem list → ${path.relative(ROOT, OUT_FILE)} (limit=${opts.limit}, delay=${opts.delay}ms)`,
  );

  while (pages < opts.maxPages) {
    const json = await fetchAssemList({ limit: opts.limit, offset });
    if (totalCount == null) {
      totalCount = Number(json.count) || 0;
      console.log(`Server count=${totalCount}`);
    }
    const list = Array.isArray(json.result) ? json.result : [];
    if (list.length === 0) break;

    for (const item of list) {
      fetched += 1;
      const id = String(item.mgrSeq);
      const title = item.assemTitle || "";
      if (!isAssemblyPostTitle(title)) {
        skippedFilter += 1;
        continue;
      }
      if (existing.has(id)) {
        skippedExisting += 1;
        continue;
      }
      const record = slimRecord(item);
      writeStream.write(`${JSON.stringify(record)}\n`);
      existing.add(id);
      kept += 1;
    }

    pages += 1;
    offset += opts.limit;
    process.stdout.write(
      `\r  page ${pages} offset=${offset} kept=${kept} filtered=${skippedFilter} resume_skip=${skippedExisting}`,
    );

    if (offset >= totalCount) break;
    await sleep(opts.delay);
  }

  await new Promise((resolve, reject) => {
    writeStream.end(() => resolve());
    writeStream.on("error", reject);
  });

  const meta = {
    crawled_at: new Date().toISOString(),
    server_count: totalCount,
    pages,
    fetched_rows: fetched,
    kept_assembly_posts: kept,
    skipped_filter: skippedFilter,
    skipped_existing: skippedExisting,
    note:
      "SPATIC board history starts ~2024-03-18; 2021 data is not available on this site. Roadworks titles excluded. List loads via AJAX; this script calls getList.json directly (no geolocation).",
    out_file: path.relative(ROOT, OUT_FILE),
  };
  fs.writeFileSync(META_FILE, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(`\nDone. New posts written: ${kept}`);
  console.log(`Meta: ${path.relative(ROOT, META_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
