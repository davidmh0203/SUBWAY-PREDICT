#!/usr/bin/env node
/**
 * Crawl 서울교통공사 지하철알림정보 (getNtceList) from a start date → CSV.
 *
 * Auth (prefer Decoding → Encoding fallback):
 *   TRAIN_ALERT_API_DECOIND_KEY  — Decoding (spelling DECOIND, not DECODE)
 *   TRAIN_ALERT_API_KEY          — Encoding (append raw)
 *
 * Usage:
 *   node scripts/crawl-metro-ntce.mjs
 *   node scripts/crawl-metro-ntce.mjs --start 20200101 --end 20260713
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = "https://apis.data.go.kr/B553766/ntce/getNtceList";
const OUT_DIR = path.join(ROOT, "data", "metro-ntce");

const DECODING_ENV = "TRAIN_ALERT_API_DECOIND_KEY";
const ENCODING_ENV = "TRAIN_ALERT_API_KEY";

const SELECT_FIELDS = [
  "noftSeCd",
  "noftTtl",
  "noftCn",
  "nonstopYn",
  "upbdnbSe",
  "xcseSitnBgngDt",
  "xcseSitnEndDt",
  "lineNm",
  "lineNmLst",
  "stnCd",
  "stnSctnCdLst",
  "noftOcrnDt",
  "crtrYmd",
].join(",");

const NOFT_SE_CD = {
  1: "화재",
  2: "차량고장",
  3: "열차사고",
  4: "시설장애",
  5: "단순지연",
  6: "기타",
  7: "정규시간표",
  8: "임시시간표",
};

const CSV_COLUMNS = [
  "noft_ocrn_dt",
  "crtr_ymd",
  "noft_se_cd",
  "noft_se_nm",
  "noft_ttl",
  "noft_cn",
  "nonstop_yn",
  "upbdnb_se",
  "xcse_sitn_bgng_dt",
  "xcse_sitn_end_dt",
  "line_nm_lst",
  "stn_sctn_cd_lst",
];

async function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const text = await readFile(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function parseArgs(argv) {
  const opts = {
    start: "20200101",
    end: ymd(new Date()),
    pageSize: 100,
    delayMs: 350,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--start") opts.start = argv[++i];
    else if (a === "--end") opts.end = argv[++i];
    else if (a === "--page-size") opts.pageSize = Number(argv[++i]);
    else if (a === "--delay") opts.delayMs = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/crawl-metro-ntce.mjs [--start YYYYMMDD] [--end YYYYMMDD]
  Default: 20200101 → today`);
      process.exit(0);
    }
  }
  return opts;
}

function buildUrl(params, serviceKey, mode) {
  const qs = new URLSearchParams(params).toString();
  if (mode === "decoding") {
    const withKey = new URLSearchParams(params);
    withKey.set("serviceKey", serviceKey);
    return `${BASE}?${withKey.toString()}`;
  }
  return `${BASE}?${qs}&serviceKey=${serviceKey}`;
}

function isApiOk(header) {
  const code = String(header?.resultCode ?? "");
  return code === "00" || code === "0" || code === "";
}

function extractItems(payload) {
  const body = payload?.response?.body ?? payload?.body ?? payload;
  const header = payload?.response?.header ?? payload?.header;
  const totalCount = Number(body?.totalCount ?? 0);
  let items = body?.items?.item ?? body?.items ?? body?.item ?? [];
  if (!Array.isArray(items)) items = items ? [items] : [];
  return { header, totalCount, items };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function resolveAuth() {
  const decodingKey = process.env[DECODING_ENV];
  const encodingKey = process.env[ENCODING_ENV];
  if (decodingKey) {
    return { serviceKey: decodingKey, mode: "decoding", envVar: DECODING_ENV };
  }
  if (encodingKey) {
    return { serviceKey: encodingKey, mode: "encoding", envVar: ENCODING_ENV };
  }
  throw new Error(
    `Missing auth: set ${DECODING_ENV} (preferred) and/or ${ENCODING_ENV} in .env`,
  );
}

async function fetchPage({ serviceKey, mode, start, end, pageNo, numOfRows }) {
  const url = buildUrl(
    {
      dataType: "JSON",
      pageNo: String(pageNo),
      numOfRows: String(numOfRows),
      srchStartNoftOcrnYmd: start,
      srchEndNoftOcrnYmd: end,
      selectFields: SELECT_FIELDS,
    },
    serviceKey,
    mode,
  );
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const { header, totalCount, items } = extractItems(json);
  if (!res.ok || !isApiOk(header)) {
    throw new Error(
      `API error HTTP ${res.status} code=${header?.resultCode} msg=${header?.resultMsg}`,
    );
  }
  return { totalCount, items };
}

/** Yield [startYmd, endYmd] month windows covering [start, end]. */
function* monthWindows(startYmd, endYmd) {
  const sy = Number(startYmd.slice(0, 4));
  const sm = Number(startYmd.slice(4, 6));
  const ey = Number(endYmd.slice(0, 4));
  const em = Number(endYmd.slice(4, 6));
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    const mm = String(m).padStart(2, "0");
    const monthStart = `${y}${mm}01`;
    const lastDay = new Date(y, m, 0).getDate();
    let monthEnd = `${y}${mm}${String(lastDay).padStart(2, "0")}`;
    if (monthStart < startYmd) {
      /* clamp start inside first month */
    }
    const winStart = monthStart < startYmd ? startYmd : monthStart;
    const winEnd = monthEnd > endYmd ? endYmd : monthEnd;
    if (winStart <= winEnd) yield [winStart, winEnd];
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normalizeItem(item) {
  const se = String(item.noftSeCd ?? "").trim();
  return {
    noft_ocrn_dt: item.noftOcrnDt ?? "",
    crtr_ymd: item.crtrYmd ?? "",
    noft_se_cd: se,
    noft_se_nm: NOFT_SE_CD[se] ?? "",
    noft_ttl: item.noftTtl ?? "",
    noft_cn: item.noftCn ?? "",
    nonstop_yn: item.nonstopYn ?? "",
    upbdnb_se: item.upbdnbSe ?? "",
    xcse_sitn_bgng_dt: item.xcseSitnBgngDt ?? "",
    xcse_sitn_end_dt: item.xcseSitnEndDt ?? "",
    line_nm_lst: item.lineNmLst ?? item.lineNm ?? "",
    stn_sctn_cd_lst: item.stnSctnCdLst ?? item.stnCd ?? "",
  };
}

function itemKey(row) {
  return [
    row.noft_ocrn_dt,
    row.noft_ttl,
    row.noft_se_cd,
    row.nonstop_yn,
    row.line_nm_lst,
    row.stn_sctn_cd_lst,
  ].join("|");
}

async function main() {
  await loadDotEnv();
  const opts = parseArgs(process.argv.slice(2));
  const auth = await resolveAuth();
  console.log(
    `Auth: ${auth.envVar} (${auth.mode}). Range ${opts.start} → ${opts.end}`,
  );

  await mkdir(OUT_DIR, { recursive: true });
  const outCsv = path.join(OUT_DIR, `ntce-notices-${opts.start}-${opts.end}.csv`);
  const outMeta = path.join(OUT_DIR, `ntce-notices-${opts.start}-${opts.end}.meta.json`);
  const latestCsv = path.join(OUT_DIR, "ntce-notices.csv");

  const seen = new Set();
  const rows = [];
  let apiReported = 0;
  let windows = 0;

  for (const [winStart, winEnd] of monthWindows(opts.start, opts.end)) {
    windows += 1;
    let pageNo = 1;
    let total = null;
    for (;;) {
      let result;
      try {
        result = await fetchPage({
          serviceKey: auth.serviceKey,
          mode: auth.mode,
          start: winStart,
          end: winEnd,
          pageNo,
          numOfRows: opts.pageSize,
        });
      } catch (err) {
        console.warn(`  retry ${winStart}-${winEnd} p${pageNo}: ${err.message}`);
        await sleep(opts.delayMs * 3);
        result = await fetchPage({
          serviceKey: auth.serviceKey,
          mode: auth.mode,
          start: winStart,
          end: winEnd,
          pageNo,
          numOfRows: opts.pageSize,
        });
      }

      if (total == null) {
        total = result.totalCount;
        apiReported += total;
      }
      for (const item of result.items) {
        const row = normalizeItem(item);
        const key = itemKey(row);
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
      }

      const fetched = pageNo * opts.pageSize;
      process.stdout.write(
        `\r  ${winStart}-${winEnd} page ${pageNo} windowTotal=${total} kept=${rows.length}   `,
      );
      if (result.items.length === 0 || fetched >= total) break;
      pageNo += 1;
      await sleep(opts.delayMs);
    }
    await sleep(opts.delayMs);
  }

  rows.sort((a, b) => String(a.noft_ocrn_dt).localeCompare(String(b.noft_ocrn_dt)));

  const lines = [
    CSV_COLUMNS.join(","),
    ...rows.map((r) => CSV_COLUMNS.map((c) => csvEscape(r[c])).join(",")),
  ];
  const csvBody = `\uFEFF${lines.join("\n")}\n`;
  await writeFile(outCsv, csvBody);
  await writeFile(latestCsv, csvBody);

  const bySe = {};
  const byYear = {};
  let nonstop = 0;
  for (const r of rows) {
    bySe[r.noft_se_cd || "?"] = (bySe[r.noft_se_cd || "?"] || 0) + 1;
    const y = String(r.noft_ocrn_dt).slice(0, 4) || "?";
    byYear[y] = (byYear[y] || 0) + 1;
    if (String(r.nonstop_yn).toUpperCase() === "Y") nonstop += 1;
  }

  const meta = {
    crawled_at: new Date().toISOString(),
    auth_env: auth.envVar,
    auth_mode: auth.mode,
    start: opts.start,
    end: opts.end,
    month_windows: windows,
    api_totalcount_sum_months: apiReported,
    unique_rows: rows.length,
    nonstop_y: nonstop,
    by_noft_se_cd: bySe,
    by_year: byYear,
    csv: path.relative(ROOT, latestCsv),
    dated_csv: path.relative(ROOT, outCsv),
  };
  await writeFile(outMeta, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(`\nDone. unique rows=${rows.length}`);
  console.log(`CSV: ${path.relative(ROOT, latestCsv)}`);
  console.log(`Meta: ${path.relative(ROOT, outMeta)}`);
  console.log("by_year", byYear);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
