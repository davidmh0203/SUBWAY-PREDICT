#!/usr/bin/env node
/**
 * Live probe for 서울교통공사 지하철알림정보 (B553766/ntce/getNtceList).
 *
 * Auth (prefer Decoding → fall back Encoding):
 *   TRAIN_ALERT_API_DECOIND_KEY  — Decoding key (spelling DECOIND, not DECODE)
 *   TRAIN_ALERT_API_KEY          — Encoding key (URL-encoded; append raw)
 *
 * Never logs or writes either service key.
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = "https://apis.data.go.kr/B553766/ntce/getNtceList";
const KEYWORDS = ["시위", "집회", "전장연", "무정차", "혼잡", "공사"];
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
  "noftOcrnDt",
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

/** Env var for Decoding key — intentional misspelling DECOIND (not DECODE). Do not "fix". */
const DECODING_ENV = "TRAIN_ALERT_API_DECOIND_KEY";
const ENCODING_ENV = "TRAIN_ALERT_API_KEY";

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

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * @param {"decoding"|"encoding"} mode
 * decoding: URLSearchParams encodes + / = once (preferred for Decoding keys)
 * encoding: append Encoding key raw so %xx is not double-encoded
 */
function buildUrl(params, serviceKey, mode) {
  const qs = new URLSearchParams(params).toString();
  if (mode === "decoding") {
    const withKey = new URLSearchParams(params);
    withKey.set("serviceKey", serviceKey);
    return `${BASE}?${withKey.toString()}`;
  }
  return `${BASE}?${qs}&serviceKey=${serviceKey}`;
}

function extractItems(payload) {
  const body = payload?.response?.body ?? payload?.body ?? payload;
  const header = payload?.response?.header ?? payload?.header;
  const totalCount = Number(body?.totalCount ?? 0);
  let items = body?.items?.item ?? body?.items ?? body?.item ?? [];
  if (!Array.isArray(items)) items = items ? [items] : [];
  return { header, totalCount, items, bodyKeys: body ? Object.keys(body) : [] };
}

function isAuthFailure(header, status, textSnippet) {
  const code = String(header?.resultCode ?? "");
  const msg = String(header?.resultMsg ?? "");
  if (status === 401 || status === 403) return true;
  if (/SERVICE_KEY|UNAUTHORIZED|FORBIDDEN|NOT_REGISTERED|INVALID_REQUEST_PARAMETER/i.test(msg)) {
    return true;
  }
  if (code && code !== "00" && code !== "0" && /KEY|AUTH|REGISTER/i.test(msg + code)) {
    return true;
  }
  if (/SERVICE_KEY_IS_NOT_REGISTERED|HTTP ERROR/i.test(textSnippet)) return true;
  return false;
}

function isApiOk(header) {
  const code = String(header?.resultCode ?? "");
  return code === "00" || code === "0" || code === "";
}

async function fetchPage({ serviceKey, mode, start, end, pageNo, numOfRows, extra = {} }) {
  const url = buildUrl(
    {
      dataType: "JSON",
      pageNo: String(pageNo),
      numOfRows: String(numOfRows),
      srchStartNoftOcrnYmd: start,
      srchEndNoftOcrnYmd: end,
      selectFields: SELECT_FIELDS,
      ...extra,
    },
    serviceKey,
    mode,
  );
  const res = await fetch(url);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      status: res.status,
      json: null,
      textSnippet: text.slice(0, 240).replace(/\s+/g, " "),
      header: null,
      ok: false,
    };
  }
  const header = json?.response?.header ?? json?.header ?? null;
  return {
    status: res.status,
    json,
    textSnippet: text.slice(0, 240).replace(/\s+/g, " "),
    header,
    ok: res.ok && isApiOk(header),
  };
}

/**
 * Prefer Decoding env, fall back to Encoding.
 * Returns { serviceKey, mode, envVar } without exposing the key value.
 */
async function resolveAuth() {
  const decodingKey = process.env[DECODING_ENV];
  const encodingKey = process.env[ENCODING_ENV];
  const end = ymd(new Date());
  const start = ymd(daysAgo(29));
  const smoke = { start, end, pageNo: 1, numOfRows: 1 };

  const candidates = [];
  if (decodingKey) {
    candidates.push({
      envVar: DECODING_ENV,
      mode: "decoding",
      serviceKey: decodingKey,
      meta: `decoding len=${decodingKey.length} +/=`,
    });
  }
  if (encodingKey) {
    candidates.push({
      envVar: ENCODING_ENV,
      mode: "encoding",
      serviceKey: encodingKey,
      meta: `encoding len=${encodingKey.length} pct=${encodingKey.includes("%")}`,
    });
  }
  if (!candidates.length) {
    throw new Error(
      `Missing auth: set ${DECODING_ENV} (preferred) and/or ${ENCODING_ENV} in .env`,
    );
  }

  const attempts = [];
  for (const c of candidates) {
    const res = await fetchPage({ ...smoke, serviceKey: c.serviceKey, mode: c.mode });
    const authFail =
      !res.json ||
      isAuthFailure(res.header, res.status, res.textSnippet) ||
      !res.ok;
    attempts.push({
      envVar: c.envVar,
      mode: c.mode,
      http: res.status,
      resultCode: res.header?.resultCode ?? null,
      resultMsg: res.header?.resultMsg ?? null,
      ok: !authFail && res.ok,
    });
    if (!authFail && res.ok) {
      return { ...c, attempts };
    }
  }

  const detail = attempts
    .map(
      (a) =>
        `${a.envVar}/${a.mode}: http=${a.http} code=${a.resultCode} msg=${a.resultMsg}`,
    )
    .join("; ");
  throw new Error(`All auth candidates failed. ${detail}`);
}

async function fetchWindow(auth, days, numOfRows = 100, maxPages = 5) {
  const end = ymd(new Date());
  const start = ymd(daysAgo(days - 1));
  const all = [];
  let totalCount = 0;
  let header = null;
  let bodyKeys = [];
  let pagesFetched = 0;

  for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
    const res = await fetchPage({
      serviceKey: auth.serviceKey,
      mode: auth.mode,
      start,
      end,
      pageNo,
      numOfRows,
    });
    if (!res.json) {
      throw new Error(`HTTP ${res.status} non-JSON: ${res.textSnippet}`);
    }
    const extracted = extractItems(res.json);
    header = extracted.header ?? header;
    bodyKeys = extracted.bodyKeys.length ? extracted.bodyKeys : bodyKeys;
    totalCount = extracted.totalCount || totalCount;
    pagesFetched = pageNo;

    const resultCode = header?.resultCode ?? "";
    const resultMsg = header?.resultMsg ?? "";
    if (String(resultCode) && String(resultCode) !== "00" && String(resultCode) !== "0") {
      throw new Error(
        `API error resultCode=${resultCode} resultMsg=${resultMsg} http=${res.status}`,
      );
    }
    if (!extracted.items.length) break;
    all.push(...extracted.items);
    if (all.length >= totalCount || extracted.items.length < numOfRows) break;
  }

  return { start, end, totalCount, pagesFetched, items: all, header, bodyKeys };
}

function fieldPresence(items) {
  const keys = new Set();
  for (const it of items) {
    for (const k of Object.keys(it ?? {})) keys.add(k);
  }
  const counts = {};
  for (const k of keys) {
    counts[k] = items.filter((it) => it?.[k] != null && String(it[k]).trim() !== "").length;
  }
  return { keys: [...keys].sort(), counts };
}

function codeDist(items) {
  const dist = {};
  for (const it of items) {
    const c = String(it?.noftSeCd ?? "?");
    dist[c] = (dist[c] ?? 0) + 1;
  }
  return Object.entries(dist)
    .sort(([a], [b]) => Number(a) - Number(b) || a.localeCompare(b))
    .map(([code, n]) => ({
      code,
      label: NOFT_SE_CD[code] ?? "unknown",
      n,
    }));
}

function keywordHits(items) {
  const re = new RegExp(KEYWORDS.join("|"), "g");
  const byKw = Object.fromEntries(KEYWORDS.map((k) => [k, []]));
  const any = [];
  for (const it of items) {
    // Strip org name so "서울교통공사" does not false-hit "공사"
    const blob = `${it?.noftTtl ?? ""} ${it?.noftCn ?? ""}`.replace(
      /서울교통공사/g,
      "",
    );
    const found = new Set();
    for (const m of blob.matchAll(re)) found.add(m[0]);
    if (!found.size) continue;
    const sample = {
      noftSeCd: it?.noftSeCd,
      noftSeLabel: NOFT_SE_CD[String(it?.noftSeCd)] ?? "?",
      nonstopYn: it?.nonstopYn,
      lineNm: it?.lineNm ?? it?.lineNmLst,
      stnCd: it?.stnCd ?? it?.stnSctnCdLst,
      noftOcrnDt: it?.noftOcrnDt,
      noftTtl: it?.noftTtl,
      hits: [...found],
    };
    any.push(sample);
    for (const k of found) byKw[k]?.push(sample);
  }
  return {
    byKeyword: Object.fromEntries(
      KEYWORDS.map((k) => [k, { count: byKw[k].length, samples: byKw[k].slice(0, 3) }]),
    ),
    anyCount: any.length,
    samples: any.slice(0, 5),
  };
}

function summarize(label, win) {
  const fields = fieldPresence(win.items);
  const dist = codeDist(win.items);
  const kw = keywordHits(win.items);
  const nonstop = win.items.filter((it) => String(it?.nonstopYn).toUpperCase() === "Y");
  return {
    window: label,
    range: `${win.start}–${win.end}`,
    totalCount: win.totalCount,
    fetched: win.items.length,
    pagesFetched: win.pagesFetched,
    resultCode: win.header?.resultCode,
    resultMsg: win.header?.resultMsg,
    responseFieldKeys: fields.keys,
    fieldNonEmptyCounts: fields.counts,
    noftSeCdDist: dist,
    nonstopYnY: nonstop.length,
    keywords: kw,
  };
}

async function main() {
  await loadDotEnv();

  const outDir = path.join(ROOT, "tmp");
  await mkdir(outDir, { recursive: true });

  console.log("Probing getNtceList (dataType=JSON)…");
  console.log(
    `auth candidates: ${DECODING_ENV}=${process.env[DECODING_ENV] ? "set" : "missing"}, ${ENCODING_ENV}=${process.env[ENCODING_ENV] ? "set" : "missing"}`,
  );
  console.log(
    `note: Decoding env is spelled DECOIND (not DECODE) — do not rename`,
  );

  const auth = await resolveAuth();
  console.log(`using ${auth.envVar} mode=${auth.mode} (${auth.meta})`);
  for (const a of auth.attempts) {
    console.log(
      `  try ${a.envVar}/${a.mode}: http=${a.http} code=${a.resultCode} ok=${a.ok}`,
    );
  }

  const win7 = await fetchWindow(auth, 7);
  const win30 = await fetchWindow(auth, 30);

  const summary = {
    probedAt: new Date().toISOString(),
    endpoint: BASE,
    auth: {
      preferredEnv: DECODING_ENV,
      fallbackEnv: ENCODING_ENV,
      usedEnv: auth.envVar,
      mode: auth.mode,
      // intentional typo note for operators
      spellingNote: "TRAIN_ALERT_API_DECOIND_KEY uses DECOIND (not DECODE); do not rename",
      attempts: auth.attempts,
    },
    note: "Protest is not a dedicated noftSeCd; codes 1–8 only.",
    noftSeCdMeanings: NOFT_SE_CD,
    windows: {
      d7: summarize("7d", win7),
      d30: summarize("30d", win30),
    },
  };

  const samplePath = path.join(outDir, "ntce-sample.json");
  await writeFile(
    samplePath,
    JSON.stringify(
      {
        header: win30.header,
        totalCount: win30.totalCount,
        authUsed: { envVar: auth.envVar, mode: auth.mode },
        sampleItems: win30.items.slice(0, 20),
      },
      null,
      2,
    ),
  );
  await writeFile(path.join(outDir, "ntce-probe-summary.json"), JSON.stringify(summary, null, 2));

  const s30 = summary.windows.d30;
  console.log("\n=== 30-day window ===");
  console.log(`range ${s30.range} totalCount=${s30.totalCount} fetched=${s30.fetched}`);
  console.log(`fields: ${s30.responseFieldKeys.join(", ") || "(none)"}`);
  console.log("noftSeCd dist:");
  for (const row of s30.noftSeCdDist) {
    console.log(`  ${row.code} ${row.label}: ${row.n}`);
  }
  console.log(`nonstopYn=Y: ${s30.nonstopYnY}`);
  console.log("keyword hits (title|content, 서울교통공사 stripped):");
  for (const [k, v] of Object.entries(s30.keywords.byKeyword)) {
    console.log(`  ${k}: ${v.count}`);
  }
  if (s30.keywords.samples.length) {
    console.log("samples:");
    for (const s of s30.keywords.samples) {
      console.log(
        `  [${s.noftSeCd}/${s.noftSeLabel}] nonstop=${s.nonstopYn} line=${s.lineNm} stn=${s.stnCd} hits=${s.hits.join(",")} | ${s.noftTtl}`,
      );
    }
  }

  const s7 = summary.windows.d7;
  console.log("\n=== 7-day window ===");
  console.log(`range ${s7.range} totalCount=${s7.totalCount} fetched=${s7.fetched}`);
  console.log(`keyword any: ${s7.keywords.anyCount} nonstopY=${s7.nonstopYnY}`);
  console.log(`\nWrote ${samplePath}`);
  console.log(`Wrote ${path.join(outDir, "ntce-probe-summary.json")}`);
}

main().catch((err) => {
  console.error("Probe failed:", err.message);
  process.exit(1);
});
