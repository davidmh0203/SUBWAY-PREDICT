/** Shared helpers for SMPA 「오늘의 집회/시위」 board crawl/parse. */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const SMPA_BASE = "https://www.smpa.go.kr";
export const SMPA_BOARD_PATH = "/user/nd54882.do";
export const SMPA_LIST_URL = `${SMPA_BASE}${SMPA_BOARD_PATH}`;

export const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; YeoyuroSmpaCrawl/1.0; +https://github.com/)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

/** SPATIC assem-events coverage starts here; SMPA fills earlier gaps. */
export const SPATIC_COVERAGE_START = "2024-03-18";

/** Analysis window: drop rows/posts before this date. */
export const DATA_START = "2020-01-01";

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function detailUrl(boardNo, page = 1) {
  const q = new URLSearchParams({
    View: "",
    page: String(page),
    pageSC: "SORT_ORDER",
    pageSO: "DESC",
    dmlType: "",
    boardNo: String(boardNo),
  });
  // SMPA JS builds `?View&page=…` (literal key `View` with empty value)
  return `${SMPA_LIST_URL}?${q.toString().replace(/^View=/, "View")}`;
}

export function listUrl(page) {
  const q = new URLSearchParams({
    page: String(page),
    pageSC: "SORT_ORDER",
    pageSO: "DESC",
    dmlType: "SELECT",
  });
  return `${SMPA_LIST_URL}?${q}`;
}

export function attachDownloadUrl(attachNo) {
  return `${SMPA_BASE}/common/attachfile/attachfileDownload.do?attachNo=${attachNo}`;
}

const ENTITY_MAP = {
  nbsp: " ",
  sim: "∼",
  rarr: "→",
  larr: "←",
  mdash: "—",
  ndash: "–",
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
  middot: "·",
  hellip: "…",
};

export function decodeHtmlEntities(input = "") {
  return String(input)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-F]+);/g, (full, name) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(ENTITY_MAP, key)
        ? ENTITY_MAP[key]
        : full;
    });
}

export function htmlToPlainText(html = "") {
  let s = String(html);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeHtmlEntities(s);
  s = s.replace(/\r/g, "");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s.trim();
}

const DOW_KO = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

/** YYMMDD → YYYY-MM-DD, or "" if invalid. */
export function yymmddToIso(yymmdd = "") {
  const s = String(yymmdd);
  if (!/^\d{6}$/.test(s)) return "";
  const yy = Number(s.slice(0, 2));
  const mm = Number(s.slice(2, 4));
  const dd = Number(s.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
  const year = yy >= 90 ? 1900 + yy : 2000 + yy;
  // SMPA board starts ~2011; reject absurd years from bad tokens
  if (year < 2010 || year > 2035) return "";
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function addDaysIso(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Weekday 0=Sun … 6=Sat for a calendar date (KST noon). */
export function weekdayKst(iso = "") {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return -1;
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0)).getUTCDay(); // 12:00 KST
}

/**
 * Align YYMMDD with an optional 요일 letter.
 * SMPA often posts tomorrow's schedule the day before and the title
 * YYMMDD can lag (e.g. title `260721 수` + attach `260722(수)`).
 */
export function reconcileYymmddWithDow(yymmdd, dowLetter = "") {
  const iso = yymmddToIso(yymmdd);
  if (!iso) return "";
  const want = DOW_KO[dowLetter];
  if (want == null) return iso;
  if (weekdayKst(iso) === want) return iso;
  // Prefer +1 (전날 게시) then nearby days with matching weekday
  for (const delta of [1, -1, 2, -2, 3, -3]) {
    const cand = addDaysIso(iso, delta);
    if (weekdayKst(cand) === want) return cand;
  }
  return iso;
}

/** Title → event YYYY-MM-DD (요일로 YYMMDD 보정). */
export function eventDateFromTitle(title = "") {
  const m = String(title).match(/(\d{6})\s*[(\[]?\s*([월화수목금토일])?/);
  if (!m) return "";
  return reconcileYymmddWithDow(m[1], m[2] || "");
}

/** Attachment name → event date, e.g. `260722(수) 오늘의 주요집회.pdf`. */
export function eventDateFromAttachmentName(name = "") {
  const m = String(name).match(/(\d{6})\s*[(\[]?\s*([월화수목금토일])?/);
  if (!m) return "";
  return reconcileYymmddWithDow(m[1], m[2] || "");
}

/** Body header → date, e.g. `2026. 7. 22.(수)`. */
export function eventDateFromPlain(plain = "") {
  const m = String(plain).match(
    /(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*[(\[]?\s*([월화수목금토일])?/,
  );
  if (!m) return "";
  const iso = `${m[1]}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
  const want = DOW_KO[m[4] || ""];
  if (want == null) return iso;
  if (weekdayKst(iso) === want) return iso;
  return iso;
}

/**
 * Best event date for an SMPA post.
 * Priority: 주요집회 첨부명 → 본문/PDF 헤더 → 제목(요일 보정).
 */
export function resolveSmpaEventDate({
  title = "",
  attachments = [],
  plain = "",
} = {}) {
  const major = attachments.filter((a) => /주요집회|오늘의\s*집회/i.test(a.name || ""));
  const pool = major.length ? major : attachments;
  for (const a of pool) {
    const d = eventDateFromAttachmentName(a.name);
    if (d) return d;
  }
  const fromPlain = eventDateFromPlain(plain);
  if (fromPlain) return fromPlain;
  return eventDateFromTitle(title);
}

/** Keep raw string + numeric total when possible (신고인원 / 인원 / 총 N명). */
export function parsePersonnelCount(raw = "") {
  const s = String(raw).replace(/\s+/g, " ").trim();
  if (!s) return "";
  const total = s.match(/총\s*([\d,]+)\s*명/);
  if (total) return Number(total[1].replace(/,/g, ""));
  const first = s.match(/([\d,]+)\s*명/);
  if (first) return Number(first[1].replace(/,/g, ""));
  const bare = s.match(/^([\d,]+)$/);
  if (bare) return Number(bare[1].replace(/,/g, ""));
  return "";
}

export function normalizePersonnelRaw(raw = "") {
  const s = String(raw).replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (/명/.test(s)) return s;
  const n = s.replace(/,/g, "");
  if (/^\d+$/.test(n)) return `${Number(n).toLocaleString("en-US")}명`;
  return s;
}

export function parseListHtml(html = "") {
  const items = [];
  // Rows: goBoardView(...boardNo...) title … date cell
  const rowRe =
    /goBoardView\(\s*'\/user\/nd54882\.do'\s*,\s*'View'\s*,\s*'(\d+)'\s*\)[\s\S]*?>\s*([^<\n]+?)\s*<\/a>[\s\S]*?<td>(\d{4}-\d{2}-\d{2})<\/td>/gi;
  let m;
  while ((m = rowRe.exec(html))) {
    items.push({
      boardNo: m[1],
      title: decodeHtmlEntities(m[2]).replace(/\s+/g, " ").trim(),
      postDate: m[3],
    });
  }
  if (items.length) return items;

  // Fallback: separate extracts (less precise pairing)
  const ids = [...html.matchAll(/goBoardView\(\s*'\/user\/nd54882\.do'\s*,\s*'View'\s*,\s*'(\d+)'\s*\)/gi)].map(
    (x) => x[1],
  );
  const titles = [
    ...html.matchAll(
      /goBoardView\(\s*'\/user\/nd54882\.do'\s*,\s*'View'\s*,\s*'(\d+)'\s*\)[^>]*>\s*([^<\n]+)/gi,
    ),
  ].map((x) => ({ boardNo: x[1], title: decodeHtmlEntities(x[2]).trim() }));
  const dates = [...html.matchAll(/<td>(\d{4}-\d{2}-\d{2})<\/td>/gi)].map(
    (x) => x[1],
  );
  const byId = new Map(titles.map((t) => [t.boardNo, t.title]));
  for (let i = 0; i < ids.length; i++) {
    items.push({
      boardNo: ids[i],
      title: byId.get(ids[i]) || "",
      postDate: dates[i] || "",
    });
  }
  return items;
}

export function parseAttachments(html = "") {
  const out = [];
  const seen = new Set();

  for (const m of html.matchAll(
    /attachfileDownload\(\s*'([^']+)'\s*,\s*'(\d+)'\s*\)[^>]*>\s*([^<\n]+)/gi,
  )) {
    const attachNo = m[2];
    const name = decodeHtmlEntities(m[3]).trim();
    const key = `no:${attachNo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      kind: "attachNo",
      attachNo,
      name,
      url: attachDownloadUrl(attachNo),
    });
  }

  for (const m of html.matchAll(
    /href="(https?:\/\/[^"]+\.(?:hwp|pdf|jpe?g|png))"/gi,
  )) {
    let url = m[1].replace(/^http:\/\//i, "https://");
    // encode path segments (legacy filenames may contain parentheses)
    try {
      const u = new URL(url);
      u.pathname = u.pathname
        .split("/")
        .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
        .join("/");
      url = u.toString();
    } catch {
      /* keep raw */
    }
    const name = decodeURIComponent(url.split("/").pop() || "file");
    const key = `url:${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: "href", attachNo: "", name, url });
  }

  return out;
}

export function extractTextViaPdftotext(filePath) {
  const r = spawnSync("pdftotext", ["-layout", filePath, "-"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) return "";
  return String(r.stdout || "").trim();
}

export function extractTextViaTesseract(filePath, { tessdataDir } = {}) {
  const env = { ...process.env };
  if (tessdataDir) env.TESSDATA_PREFIX = tessdataDir;
  const langs = fs.existsSync(
    path.join(
      tessdataDir || "/opt/homebrew/share/tessdata",
      "kor.traineddata",
    ),
  )
    ? "kor+eng"
    : "eng";
  const r = spawnSync("tesseract", [filePath, "stdout", "-l", langs], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env,
  });
  if (r.error || (r.status !== 0 && !r.stdout)) return "";
  return String(r.stdout || "").trim();
}

/**
 * Best-effort HWP5 text: OLE PrvText stream or UTF-16LE string scrape.
 * Prefer PDF when available.
 */
export function extractTextFromHwp(filePath) {
  const buf = fs.readFileSync(filePath);
  // Look for UTF-16LE runs containing Hangul / keywords
  const asUtf16 = buf.toString("utf16le");
  const chunks = [];
  for (const part of asUtf16.split(/\0+/)) {
    if (part.length < 8) continue;
    if (/[가-힣]/.test(part) && /(집회|인원|장소|신고)/.test(part)) {
      chunks.push(part.replace(/\r/g, "\n"));
    }
  }
  if (chunks.length) {
    return chunks
      .join("\n")
      .replace(/[<>]/g, "\t")
      .replace(/\t+/g, "\t")
      .trim();
  }
  // Fallback latin1 scrape of printable Korean-ish — weak
  return "";
}

export function pickBestAttachment(attachments = []) {
  const lower = (n) => String(n).toLowerCase();
  const pdf = attachments.find((a) => lower(a.name).endsWith(".pdf"));
  if (pdf) return { ...pdf, prefer: "pdf" };
  const hwp = attachments.find((a) => lower(a.name).endsWith(".hwp"));
  if (hwp) return { ...hwp, prefer: "hwp" };
  const img = attachments.find((a) =>
    /\.(jpe?g|png)$/i.test(lower(a.name)),
  );
  if (img) return { ...img, prefer: "image" };
  return null;
}

/** Detect structured HTML body blocks (modern posts). */
export function hasStructuredHtmlBody(plain = "") {
  return /집회\s*일시\s*:/.test(plain) && /신고\s*인원\s*:/.test(plain);
}

/**
 * Parse modern HTML-style blocks:
 * 집회 일시 / 집회 장소 / 신고 인원 / 관할서
 */
export function parseHtmlStyleAssemblies(plain = "") {
  const text = String(plain).replace(/\r/g, "");
  const blocks = [];
  const re =
    /집회\s*일시\s*:\s*([^\n]+)\n\s*집회\s*장소\s*:\s*([^\n]+)\n\s*신고\s*인원\s*:\s*([^\n]+)(?:\n\s*관할서\s*:\s*([^\n]+))?/g;
  let m;
  while ((m = re.exec(text))) {
    blocks.push({
      time_raw: m[1].trim(),
      place_raw: m[2].trim(),
      personnel_raw: normalizePersonnelRaw(m[3]),
      jurisdiction: (m[4] || "").trim(),
    });
  }
  return blocks;
}

function normalizeTimeToken(t = "") {
  return String(t)
    .replace(/[～∼〜]/g, "~")
    .replace(/翌/g, "다음날")
    .replace(/익일/g, "다음날")
    .replace(/\s+/g, "")
    .trim();
}

const TIME_END_TOKEN =
  String.raw`\d{1,2}:\d{2}|다음날\s*\d{1,2}:\d{2}|익일\s*\d{1,2}:\d{2}|翌\s*\d{1,2}:\d{2}|종료시|00:00`;

/** Compact (`영등포`) or PDF-spaced (`용 산`, `방 배`) 관할서. */
const JURIS_TOKEN = String.raw`[가-힣]{2,6}|[가-힣](?:\s+[가-힣]){1,5}`;

function splitTimeRange(timeRaw = "") {
  const t = normalizeTimeToken(timeRaw);
  const m = t.match(/^(\d{1,2}:\d{2})(?:~(.+))?$/);
  if (!m) return { time_start: "", time_end: "" };
  const end = m[2] || "";
  return {
    time_start: m[1].padStart(5, "0"),
    time_end: !end
      ? ""
      : end.startsWith("다음날") || end === "종료시"
        ? end
        : /^\d{1,2}:\d{2}$/.test(end)
          ? end.padStart(5, "0")
          : end,
  };
}

/** Time at start of line; end time optional (`15:30～`). Rest may be place/인원. */
const TIME_LINE_RE = new RegExp(
  `^(\\d{1,2}:\\d{2})\\s*[～∼~\\-]\\s*(${TIME_END_TOKEN})?(?:\\s*(?:\\/\\s*)?(.*))?$`,
);

function isHeaderish(line = "") {
  const s = line.replace(/\s+/g, "");
  return (
    !s ||
    /오늘의주요집회/.test(s) ||
    /기준작성/.test(s) ||
    /집회일시/.test(s) ||
    /신고인원/.test(s) ||
    /관할서/.test(s) ||
    /행사명/.test(s) ||
    /시간.?장소/.test(s) ||
    /^비고$/.test(s) ||
    /^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}/.test(line.trim())
  );
}

/** Spaced PDF 관할서 cell: `용 산`, `방 배`, `영등포`, `남대문`. */
const KNOWN_JURISDICTIONS = new Set([
  "남대문",
  "영등포",
  "종로",
  "용산",
  "마포",
  "서초",
  "동작",
  "구로",
  "송파",
  "강남",
  "중부",
  "혜화",
  "서부",
  "동대문",
  "성북",
  "노원",
  "도봉",
  "은평",
  "양천",
  "강서",
  "관악",
  "서대문",
  "성동",
  "광진",
  "중랑",
  "강동",
  "수서",
  "방배",
  "금천",
  "중구",
  "종암",
  "수색",
  "창동",
  "서부",
  "용신",
  "성동",
  "왕십리",
  "서초",
]);

function isJurisdictionOnlyLine(line = "") {
  const s = String(line).replace(/\s+/g, " ").trim();
  if (!s || /\d/.test(s) || /[<>→⇄\/]/.test(s)) return false;
  const compact = s.replace(/\s+/g, "");
  if (!/^[가-힣]{2,6}$/.test(compact)) return false;
  // PDF column splits every syllable: `용 산`, `방 배` — only if known after join
  if (/^[가-힣](\s+[가-힣]){1,4}$/.test(s)) {
    return KNOWN_JURISDICTIONS.has(compact);
  }
  return KNOWN_JURISDICTIONS.has(compact);
}

/** Right-column 신고인원 (+관할서) alone: `200 방 배`, `1,500 용 산`, `300`. */
function parsePersonnelCountLine(line = "") {
  const s = String(line).replace(/\s+/g, " ").trim();
  if (!s || !/^[\d,]/.test(s)) return null;
  let m = s.match(new RegExp(`^([\\d,]+)\\s*명?\\s+(${JURIS_TOKEN})\\s*$`));
  if (m) {
    return {
      personnel: normalizePersonnelRaw(m[1]),
      jurisdiction: m[2].replace(/\s+/g, ""),
    };
  }
  m = s.match(/^([\d,]+)\s*명?\s*$/);
  if (m) {
    return { personnel: normalizePersonnelRaw(m[1]), jurisdiction: "" };
  }
  return null;
}

function isPersonnelCountLine(line = "") {
  return Boolean(parsePersonnelCountLine(line));
}

function peelTrailingJurisdiction(place = "", jurisdiction = "") {
  let p = String(place).replace(/\s+/g, " ").trim();
  let j = jurisdiction;
  if (!p) return { place: p, jurisdiction: j };
  // trailing spaced 관할서 after real place text
  const m = p.match(
    new RegExp(`^(.*?[가-힣0-9出〉》\\]）)].*?)\\s+(${JURIS_TOKEN})$`),
  );
  if (m && isJurisdictionOnlyLine(m[2])) {
    p = m[1].trim().replace(/^\/\s*/, "");
    j = j || m[2].replace(/\s+/g, "");
  }
  return { place: p.replace(/^\/\s*/, "").trim(), jurisdiction: j };
}

/** Pull trailing 인원 + 관할서 from a pdftotext row remainder. */
function splitPlacePersonnel(rest = "") {
  let s = String(rest).replace(/\s+/g, " ").trim().replace(/^\/\s*/, "");
  if (!s) return { placePart: "", personnel: "", jurisdiction: "" };

  // Count-only remainder: `500 구 로` / `500명 송파` / `10,000`
  let m = s.match(
    new RegExp(`^([\\d,]+)\\s*명?\\s+(${JURIS_TOKEN})\\s*(?:※.*)?$`),
  );
  if (m) {
    return {
      placePart: "",
      personnel: normalizePersonnelRaw(m[1]),
      jurisdiction: m[2].replace(/\s+/g, ""),
    };
  }
  if (/^[\d,]+\s*명?$/.test(s)) {
    return {
      placePart: "",
      personnel: normalizePersonnelRaw(s.replace(/명$/, "")),
      jurisdiction: "",
    };
  }

  // … place 500명 송파  |  … place 500 송파  |  … place 10,000 종로
  m = s.match(
    new RegExp(
      `^(.*?)(?:\\s+)([\\d,]+)\\s*명?\\s+(${JURIS_TOKEN})\\s*(?:※.*)?$`,
    ),
  );
  if (m) {
    return {
      placePart: m[1].trim().replace(/^\/\s*/, ""),
      personnel: normalizePersonnelRaw(m[2]),
      jurisdiction: m[3].replace(/\s+/g, ""),
    };
  }
  m = s.match(/^(.*?)(?:\s+)([\d,]+)\s*명\s*$/);
  if (m) {
    return {
      placePart: m[1].trim().replace(/^\/\s*/, ""),
      personnel: normalizePersonnelRaw(m[2]),
      jurisdiction: "",
    };
  }
  m = s.match(/^(.*?)(?:\s+)([\d,]{1,7})\s*$/);
  if (m && m[1].length > 0 && !/^\d/.test(m[1])) {
    return {
      placePart: m[1].trim().replace(/^\/\s*/, ""),
      personnel: normalizePersonnelRaw(m[2]),
      jurisdiction: "",
    };
  }

  // place + trailing jurisdiction only (count on next line): `…서울광장 남대문`
  const peeled = peelTrailingJurisdiction(s, "");
  return {
    placePart: peeled.place,
    personnel: "",
    jurisdiction: peeled.jurisdiction,
  };
}

function scoreAssemblies(rows = []) {
  if (!rows.length) return -1;
  let score = 0;
  for (const a of rows) {
    if (a.personnel_raw) score += 3;
    if (a.place_raw && !/^<[^>]+>$/.test(a.place_raw.trim())) score += 2;
    else if (a.place_raw) score += 1;
    if (a.time_raw) score += 1;
  }
  return score;
}

/**
 * Legacy SMPA layout (〜2011–2016):
 *   11:00～13:00
 *   집회   도원빌딩 앞    100 마 포
 *          <도화동>
 * or time embedded on 집회 line with place below.
 */
export function parseLegacyJiphoeAssemblies(plain = "") {
  const text = String(plain).replace(/\r/g, "\n");
  if (/주요\s*예정\s*집회\s*없음/.test(text) && !/\d{1,2}:\d{2}/.test(text)) {
    return [];
  }
  if (!/^집회\s+/m.test(text)) return [];

  const lines = text.split("\n").map((l) => l.trimEnd());
  const rows = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const jm = trimmed.match(/^집회\s+(.+)$/);
    if (!jm) continue;

    let rest = jm[1].replace(/\s+/g, " ").trim();
    let time_raw = "";
    let place = "";
    let personnel = "";
    let jurisdiction = "";

    // 집회 14:00～17:00  100 강 남   (place below)
    let m = rest.match(
      new RegExp(
        `^(\\d{1,2}:\\d{2})\\s*[～∼~\\-]\\s*(${TIME_END_TOKEN})?\\s+([\\d,]+)\\s*명?\\s+(${JURIS_TOKEN})\\s*$`,
      ),
    );
    if (m) {
      time_raw = normalizeTimeToken(
        `${m[1]}~${(m[2] || "").replace(/\s+/g, "")}`,
      );
      personnel = normalizePersonnelRaw(m[3]);
      jurisdiction = m[4].replace(/\s+/g, "");
    } else {
      // 집회 PLACE  COUNT  JURIS
      m = rest.match(
        new RegExp(`^(.+?)\\s+([\\d,]+)\\s*명?\\s+(${JURIS_TOKEN})\\s*$`),
      );
      if (!m) continue;
      place = m[1].trim();
      // Place accidentally starts with a time → peel it
      const embedTime = place.match(
        new RegExp(
          `^(\\d{1,2}:\\d{2})\\s*[～∼~\\-]\\s*(${TIME_END_TOKEN})?\\s*(.*)$`,
        ),
      );
      if (embedTime) {
        time_raw = normalizeTimeToken(
          `${embedTime[1]}~${(embedTime[2] || "").replace(/\s+/g, "")}`,
        );
        place = (embedTime[3] || "").trim();
      }
      personnel = normalizePersonnelRaw(m[2]);
      jurisdiction = m[3].replace(/\s+/g, "");
    }

    if (!time_raw) {
      for (let p = i - 1; p >= Math.max(0, i - 3); p--) {
        const prev = lines[p].trim();
        if (!prev) continue;
        if (/^집회\s/.test(prev) || isHeaderish(prev)) break;
        const tm = prev.match(TIME_LINE_RE);
        if (tm) {
          time_raw = normalizeTimeToken(
            `${tm[1]}~${(tm[2] || "").replace(/\s+/g, "")}`,
          );
          break;
        }
      }
    }

    const placeBits = [];
    if (place) placeBits.push(place);
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const next = lines[j].trim();
      if (!next) break;
      if (/^집회\s/.test(next) || TIME_LINE_RE.test(next) || isHeaderish(next)) {
        break;
      }
      if (isPersonnelCountLine(next) || isJurisdictionOnlyLine(next)) break;
      if (/^<[^>]+>/.test(next)) {
        placeBits.push(next.match(/<[^>]+>/)[0]);
        continue;
      }
      // place continuation when time was on 집회 line
      if (!placeBits.length || /앞|역|청|당|빌딩|공원|광장|공사|교회|회관/.test(next)) {
        placeBits.push(next.replace(/\s+/g, " ").trim());
        continue;
      }
      break;
    }

    const place_raw = placeBits.join(" ").replace(/\s+/g, " ").trim();
    if (!place_raw && !personnel) continue;
    rows.push({
      time_raw,
      place_raw,
      personnel_raw: personnel,
      jurisdiction,
      march_raw: "",
    });
  }
  return rows;
}

/**
 * Parse pdftotext -layout table for SMPA PDFs (2020s column layout).
 */
export function parsePdfStyleAssemblies(plain = "") {
  const text = String(plain).replace(/\r/g, "\n");
  if (/주요\s*예정\s*집회\s*없음/.test(text) && !/\d{1,2}:\d{2}/.test(text)) {
    return [];
  }

  // Prefer dedicated legacy parser when "집회 … 인원 관할서" blocks dominate.
  const legacy = parseLegacyJiphoeAssemblies(text);
  const legacyHits = legacy.filter((a) => a.personnel_raw).length;

  const rows = [];

  // Modern single-line: 07:00~16:00   place…   500명   송파
  const modernRe =
    /^(\d{1,2}:\d{2}\s*[~\-～∼]\s*(?:\d{1,2}:\d{2}|00:00))\s+(.+?)\s+(\d[\d,]*\s*명)\s+(\S+)\s*$/gm;
  let m;
  while ((m = modernRe.exec(text))) {
    rows.push({
      time_raw: normalizeTimeToken(m[1]),
      place_raw: m[2].replace(/\s+/g, " ").trim(),
      personnel_raw: normalizePersonnelRaw(m[3]),
      jurisdiction: m[4].replace(/\s+/g, ""),
    });
  }
  if (rows.length && scoreAssemblies(rows) >= scoreAssemblies(legacy)) {
    return rows;
  }

  const lines = text.split("\n").map((l) => l.trimEnd());

  // 2020s layout: place line(s) above, time + count (+ optional mid place) on one line
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const tm = trimmed.match(TIME_LINE_RE);
    if (!tm) continue;

    // Hand off to legacy block if next non-empty is a 집회 row
    let handoff = false;
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
      const n = lines[j].trim();
      if (!n) continue;
      if (/^집회\s/.test(n)) handoff = true;
      break;
    }
    if (handoff) continue;

    const endTok = (tm[2] || "").replace(/\s+/g, "");
    const time_raw = normalizeTimeToken(`${tm[1]}~${endTok}`);
    let { placePart, personnel, jurisdiction } = splitPlacePersonnel(
      tm[3] || "",
    );

    const placeBits = [];
    // previous non-header line(s) as place title (skip if prior was also a time)
    for (let p = i - 1; p >= Math.max(0, i - 3); p--) {
      const prev = lines[p].trim();
      if (!prev) {
        if (placeBits.length) break;
        continue;
      }
      if (TIME_LINE_RE.test(prev) || isHeaderish(prev) || /^집회\s/.test(prev)) {
        break;
      }
      if (isPersonnelCountLine(prev)) break;
      if (isJurisdictionOnlyLine(prev)) {
        if (!jurisdiction) jurisdiction = prev.replace(/\s+/g, "");
        break;
      }
      // don't steal previous event's <동> when this time row has no own place yet
      if (/^<[^>]+>$/.test(prev) && !placePart && !personnel) break;
      {
        const pe = peelTrailingJurisdiction(
          prev.replace(/\s+/g, " ").trim(),
          jurisdiction,
        );
        if (pe.jurisdiction && !jurisdiction) jurisdiction = pe.jurisdiction;
        if (pe.place) placeBits.unshift(pe.place);
      }
      // usually one title line above
      if (!/^\(/.test(prev)) break;
    }
    if (placePart) placeBits.push(placePart);

    // neighborhood <동>, count/juris column lines, continued place/march below
    const marchBits = [];
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const next = lines[j].trim();
      if (!next) break;
      if (TIME_LINE_RE.test(next) || isHeaderish(next)) break;
      if (/^집회\s/.test(next)) break;

      const countLine = parsePersonnelCountLine(next);
      if (countLine) {
        if (!personnel) personnel = countLine.personnel;
        // count-line 관할서 is more reliable than floating column above
        if (countLine.jurisdiction) jurisdiction = countLine.jurisdiction;
        continue;
      }
      if (isJurisdictionOnlyLine(next)) {
        if (!jurisdiction) jurisdiction = next.replace(/\s+/g, "");
        continue;
      }
      if (/^<[^>]+>$/.test(next) || /^<[^>]+>/.test(next)) {
        placeBits.push(next.match(/<[^>]+>/)[0]);
        continue;
      }
      // ※행진 continuations only — bare place/arrow lines belong to the next event
      if (/^※\s*행진/.test(next) || /^\(/.test(next)) {
        placeBits.push(next.replace(/\s+/g, " ").trim());
        if (/행진/.test(next)) marchBits.push(next);
        continue;
      }
      break;
    }

    const peeled = peelTrailingJurisdiction(
      placeBits.join(" ").replace(/\s+/g, " ").trim(),
      jurisdiction,
    );
    const place_raw = peeled.place;
    jurisdiction = peeled.jurisdiction;
    if (!place_raw && !personnel) continue;
    rows.push({
      time_raw,
      place_raw,
      personnel_raw: personnel,
      jurisdiction,
      march_raw: marchBits.join(" ").replace(/\s+/g, " ").trim(),
    });
  }

  if (legacyHits > 0 && scoreAssemblies(legacy) >= scoreAssemblies(rows)) {
    return legacy;
  }
  return rows.length ? rows : legacy;
}

/**
 * Parse HWP PrvText-style tab tables:
 * 집회\t11:30～12:30 place \t동\t80\t남대문
 */
export function parseHwpStyleAssemblies(plain = "") {
  const text = String(plain).replace(/\r/g, "\n");
  if (/주요\s*예정\s*집회\s*없음/.test(text) && !/\d{1,2}:\d{2}/.test(text)) {
    return [];
  }
  const rows = [];
  const re =
    /집회\t+(\d{1,2}:\d{2})\s*[～∼~\-]\s*(\d{1,2}:\d{2}|다음날\s*\d{1,2}:\d{2}|00:00)\s+([^\t\n]+?)\t+([^\t\n]*)\t+([\d,]+)\t+([^\t\n]+)/g;
  let m;
  while ((m = re.exec(text))) {
    const place = [m[3].trim(), m[4].trim() ? `<${m[4].trim()}>` : ""]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    rows.push({
      time_raw: normalizeTimeToken(`${m[1]}~${m[2].replace(/\s+/g, "")}`),
      place_raw: place,
      personnel_raw: normalizePersonnelRaw(m[5]),
      jurisdiction: m[6].replace(/\s+/g, ""),
      march_raw: "",
    });
  }
  if (rows.length) return rows;

  // Fallback: spaced (non-tab) "집회 HH:MM～HH:MM place count jurisdiction"
  const loose =
    /집회\s+(\d{1,2}:\d{2})\s*[～∼~\-]\s*(\d{1,2}:\d{2})\s+(.+?)\s+([\d,]+)\s+([가-힣\s]{2,8})(?:\s|$)/g;
  while ((m = loose.exec(text))) {
    rows.push({
      time_raw: normalizeTimeToken(`${m[1]}~${m[2]}`),
      place_raw: m[3].replace(/\s+/g, " ").trim(),
      personnel_raw: normalizePersonnelRaw(m[4]),
      jurisdiction: m[5].replace(/\s+/g, ""),
      march_raw: "",
    });
  }
  return rows;
}

/** Drop/repair fragment rows where 인원 leaked into place_raw. */
export function sanitizeAssemblyRows(rows = []) {
  const cleaned = [];
  for (const a of rows) {
    let place = (a.place_raw || "").replace(/\s+/g, " ").trim();
    let personnel = a.personnel_raw || "";
    let jurisdiction = a.jurisdiction || "";

    // place is really "100 영등포" / "300 <이태원동>"
    const leaked = place.match(
      new RegExp(
        `^([\\d,]+)\\s*명?\\s+(${JURIS_TOKEN})?(?:\\s*(<[^>]+>))?\\s*$`,
      ),
    );
    if (leaked) {
      if (!personnel) personnel = normalizePersonnelRaw(leaked[1]);
      if (!jurisdiction && leaked[2]) jurisdiction = leaked[2].replace(/\s+/g, "");
      place = leaked[3] || "";
    }

    // leading count + optional spaced 관할서 + place: "200 방 배 <한강로2가>" / "300 <이태원동 등> 용 산"
    if (!personnel) {
      const lead = place.match(
        new RegExp(`^([\\d,]+)\\s*명?\\s+(?:(${JURIS_TOKEN})\\s+)?(.+)$`),
      );
      if (
        lead &&
        (lead[2] || /[<>→⇄]|역|앞|로|동|청|당|빌딩|공원|광장|공사|교회|회관|시청/.test(lead[3]))
      ) {
        personnel = normalizePersonnelRaw(lead[1]);
        if (lead[2]) jurisdiction = jurisdiction || lead[2].replace(/\s+/g, "");
        place = lead[3].trim();
      }
    }

    // trailing / mid count before neighborhood: `…프레스센터 10,000 <세종대로 등>`
    if (!personnel) {
      const mid = place.match(
        /^(.*?[가-힣出〉）)].*?)\s+([\d,]{2,7})\s*명?\s*((?:<[^>]+>.*)?)$/,
      );
      if (mid && (mid[3] || /명/.test(place))) {
        personnel = normalizePersonnelRaw(mid[2]);
        place = `${mid[1]} ${mid[3] || ""}`.replace(/\s+/g, " ").trim();
      }
    }

    const peeled = peelTrailingJurisdiction(place, jurisdiction);
    place = peeled.place;
    jurisdiction = peeled.jurisdiction;

    if (!place && !personnel) continue;
    if (
      /^[\d,]+\s*[가-힣]{0,6}$/.test(place) &&
      !/<|역|앞|로|동|청|당|병원|공원|광장|게이트|빌딩|회관|공사|교회|시청/.test(
        place,
      )
    ) {
      if (!personnel) {
        const only = parsePersonnelCountLine(place);
        if (only) {
          personnel = only.personnel;
          jurisdiction = jurisdiction || only.jurisdiction;
          place = "";
        }
      }
    }

    cleaned.push({
      ...a,
      place_raw: place,
      personnel_raw: personnel,
      jurisdiction,
    });
  }

  // Merge orphan count-only rows into the previous place row.
  const out = [];
  for (const a of cleaned) {
    const place = a.place_raw || "";
    const personnel = a.personnel_raw || "";
    if (!place && personnel) {
      if (out.length && !out[out.length - 1].personnel_raw) {
        out[out.length - 1] = {
          ...out[out.length - 1],
          personnel_raw: personnel,
          jurisdiction:
            out[out.length - 1].jurisdiction || a.jurisdiction || "",
        };
      }
      continue;
    }
    out.push(a);
  }

  // Multi-slot blocks often restate only the neighborhood `<동>` without 신고인원.
  // Carry forward the previous slot's count when this row is place-only `<…>`.
  for (let i = 1; i < out.length; i++) {
    if (out[i].personnel_raw) continue;
    if (!/^<[^>]+>\s*$/.test(out[i].place_raw || "")) continue;
    const prev = out[i - 1];
    if (!prev.personnel_raw) continue;
    out[i] = {
      ...out[i],
      personnel_raw: prev.personnel_raw,
      jurisdiction: out[i].jurisdiction || prev.jurisdiction || "",
    };
  }
  return out;
}

export function assembliesToEventRows({
  boards,
  sourcePlain,
  parseSource,
}) {
  const {
    boardNo,
    title,
    postDate,
    eventDate,
    sourceUrl,
  } = boards;

  let assemblies = [];
  if (parseSource === "html") {
    assemblies = parseHtmlStyleAssemblies(sourcePlain);
  } else if (parseSource === "hwp") {
    const hwp = parseHwpStyleAssemblies(sourcePlain);
    const pdf = parsePdfStyleAssemblies(sourcePlain);
    assemblies =
      scoreAssemblies(pdf) > scoreAssemblies(hwp) ? pdf : hwp.length ? hwp : pdf;
  } else {
    const pdf = parsePdfStyleAssemblies(sourcePlain);
    const hwp = parseHwpStyleAssemblies(sourcePlain);
    assemblies =
      scoreAssemblies(pdf) >= scoreAssemblies(hwp) ? pdf : hwp.length ? hwp : pdf;
  }
  assemblies = sanitizeAssemblyRows(assemblies);

  if (!assemblies.length) {
    return {
      assemblies: [],
      emptyReason: /주요\s*예정\s*집회\s*없음/.test(sourcePlain)
        ? "none_scheduled"
        : "parse_empty",
    };
  }

  const rows = assemblies.map((a, idx) => {
    const { time_start, time_end } = splitTimeRange(a.time_raw);
    const place = (a.place_raw || "").replace(/\s+/g, " ").trim();
    const placePrimary = place.split(/\s*→\s*/)[0]?.trim() || place;
    const personnel_raw = a.personnel_raw || "";
    const personnel_count = parsePersonnelCount(personnel_raw);
    const march_raw = a.march_raw || "";
    const focus = [placePrimary];
    if (march_raw) {
      for (const tok of march_raw.split(/→|->|⇒/)) {
        const t = tok
          .replace(/※\s*행진\s*:?/g, "")
          .replace(/\(.*?\)/g, "")
          .trim();
        if (t && t.length < 40) focus.push(t);
      }
    }
    return {
      post_id: `smpa-${boardNo}`,
      post_date: postDate || "",
      event_date: eventDate || eventDateFromTitle(title) || postDate || "",
      post_title: title || "",
      record_type: "assembly",
      seq_no: String(idx + 1),
      time_raw: a.time_raw || "",
      time_start,
      time_end,
      place_raw: place,
      place_primary: placePrimary,
      venue_raw: "",
      march_raw,
      march_start: "",
      march_end: "",
      march_waypoints: "",
      is_pre_march: "false",
      parent_seq_no: "",
      event_name: "",
      personnel_raw,
      personnel_count:
        personnel_count === "" ? "" : String(personnel_count),
      control_time_raw: "",
      control_section_raw: "",
      control_method_raw: "",
      crowd_focus_points: [...new Set(focus.filter(Boolean))].join(";"),
      parse_ok: place && (a.time_raw || personnel_raw) ? "true" : "false",
      source_url: sourceUrl || detailUrl(boardNo),
    };
  });

  return { assemblies: rows, emptyReason: "" };
}

