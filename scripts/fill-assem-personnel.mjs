#!/usr/bin/env node
/**
 * Fill empty personnel_raw / personnel_count on assem-events rows.
 *
 * 1) SPATIC 본문 하단 「인 원」 텍스트 (첨부 없이)
 * 2) 같은 event_date SMPA 첨부 집회와 느슨 매칭 → 기존 행 인원 채움
 * 3) SPATIC 기간(2024-03-18~)에 SMPA에만 있는 집회는 새 행으로 insert
 *
 * Usage:
 *   node scripts/fill-assem-personnel.mjs
 *   node scripts/fill-assem-personnel.mjs --dry-run
 *   node scripts/fill-assem-personnel.mjs --min-score 40
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assembliesToEventRows,
  eventDateFromTitle,
  parsePersonnelCount,
  DATA_START,
  SPATIC_COVERAGE_START,
  normalizePersonnelRaw,
} from "./lib/smpa-assem.mjs";
import {
  htmlToPlainText,
  normalizeSpace,
} from "./lib/spatic-assem.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DETAILS_DIR = path.join(ROOT, "data", "spatic", "raw", "smpa", "details");
const SPATIC_JSONL = path.join(ROOT, "data", "spatic", "raw", "assem.jsonl");
const OUT_EVENTS = path.join(ROOT, "data", "spatic", "assem-events.csv");
const REPORT = path.join(ROOT, "data", "spatic", "personnel-fill-report.json");

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

function parseArgs(argv) {
  const opts = { dryRun: false, minScore: 40 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--min-score") opts.minScore = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/fill-assem-personnel.mjs [--dry-run] [--min-score N]",
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
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.length);
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

/** Strip site-specific noise so SPATIC/SMPA place strings can overlap. */
export function normalizePlaceKey(s = "") {
  return String(s)
    .replace(/※\s*행진\s*:?/g, " ")
    .replace(/\([^)]*차로[^)]*\)/g, " ")
    .replace(/\([^)]*인도[^)]*\)/g, " ")
    .replace(/[<>〈〉]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /(?:서울특별시|서울시|서울|종로구|중구|용산구|성동구|광진구|동대문구|중랑구|성북구|강북구|도봉구|노원구|은평구|서대문구|마포구|양천구|강서구|구로구|금천구|영등포구|동작구|관악구|서초구|강남구|송파구|강동구)\s*/g,
      " ",
    )
    .replace(/(?:청와대\s*)?(사랑채)/g, " $1 ")
    .replace(/구\.?\s*효자(?:파출소|치안센터)?/g, " 효자 ")
    .replace(/효자(?:파출소|치안센터)/g, " 효자 ")
    .replace(/광화문R/gi, " 광화문 ")
    .replace(/홍대입구R/gi, " 홍대입구 ")
    .replace(/숭례문R/gi, " 숭례문 ")
    .replace(
      /(?:인도|차로|전차로|全차로|편도|양방향|진방|북측|남측|동측|서측|앞|뒤|인근|부근|일대|등|건너편)/g,
      " ",
    )
    .replace(/(\d+)\s*번\s*출구/g, " $1출 ")
    .replace(/[0-9０-９]+出/g, (m) => ` ${m.replace("出", "출")} `)
    .replace(/[~\-～∼→⇄⟷⟶⇒>|/<->]+/g, " ")
    .replace(/[^\uac00-\ud7a3a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function placeTokens(s = "") {
  const key = normalizePlaceKey(s);
  if (!key) return [];
  return key
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function minutesOf(hhmm = "") {
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function extractTimes(row) {
  const starts = [];
  const ends = [];
  const ts = row.time_start || "";
  const te = row.time_end || "";
  if (/^\d{1,2}:\d{2}$/.test(ts)) starts.push(ts);
  if (/^\d{1,2}:\d{2}$/.test(te)) ends.push(te);
  const raw = String(row.time_raw || "");
  for (const m of raw.matchAll(/(\d{1,2}:\d{2})\s*[～∼~\-]?\s*(\d{1,2}:\d{2})?/g)) {
    if (m[1]) starts.push(m[1].padStart(5, "0"));
    if (m[2]) ends.push(m[2].padStart(5, "0"));
  }
  return {
    starts: [...new Set(starts)],
    ends: [...new Set(ends)],
  };
}

function timeScore(a, b) {
  const A = extractTimes(a);
  const B = extractTimes(b);
  if (!A.starts.length || !B.starts.length) return 0;
  let best = 0;
  for (const sa of A.starts) {
    const ma = minutesOf(sa);
    if (ma == null) continue;
    for (const sb of B.starts) {
      const mb = minutesOf(sb);
      if (mb == null) continue;
      const d = Math.abs(ma - mb);
      let s = 0;
      if (d === 0) s = 50;
      else if (d <= 15) s = 40;
      else if (d <= 30) s = 30;
      else if (d <= 60) s = 18;
      else if (d <= 90) s = 10;
      if (s > best) best = s;
    }
  }
  // soft bonus when end also close
  if (A.ends.length && B.ends.length) {
    for (const ea of A.ends) {
      const ma = minutesOf(ea);
      if (ma == null) continue;
      for (const eb of B.ends) {
        const mb = minutesOf(eb);
        if (mb == null) continue;
        const d = Math.abs(ma - mb);
        if (d === 0) best = Math.min(70, best + 12);
        else if (d <= 30) best = Math.min(70, best + 6);
      }
    }
  }
  return best;
}

function tokenizeNoise(t) {
  return (
    t.length < 3 ||
    /^(행진|시위|집회|행사|인도|차로|전차로|편도|양방향|진방|및|등|부근|인근|일대)$/.test(
      t,
    ) ||
    /^\d+$/.test(t)
  );
}

/** Landmarks from full place_raw / march (ignore broken place_primary like "행진"). */
export function landmarkTokens(row = {}) {
  let text = [
    row.place_raw,
    row.place_primary,
    row.march_raw,
    row.march_start,
    row.march_end,
    row.venue_raw,
  ]
    .filter(Boolean)
    .join(" ");

  // SPATIC quirk: place leaked into time_raw, place_raw becomes just "행진"
  const placeOnly = String(row.place_raw || row.place_primary || "").trim();
  if (
    !placeOnly ||
    /^(행진|시위|집회)$/.test(placeOnly) ||
    placeOnly.length < 4
  ) {
    const tr = String(row.time_raw || "");
    // keep trailing place after HH:MM~HH:MM
    const after = tr
      .replace(
        /^(?:[①②③④⑤\d.\s월화수목금토일()]*)?(?:\d{1,2}:\d{2}\s*[～∼~\-]?\s*(?:\d{1,2}:\d{2})?\s*)+/g,
        " ",
      )
      .trim();
    if (after.length >= 4) text = `${text} ${after}`;
  }

  return placeTokens(text).filter((t) => !tokenizeNoise(t));
}

/** Start / end place tokens from route-like strings. */
export function endpointTokens(row = {}) {
  let text = [row.place_raw, row.march_raw, row.place_primary]
    .filter(Boolean)
    .join(" ")
    .replace(/※\s*행진\s*:?/g, " ");
  const placeOnly = String(row.place_raw || row.place_primary || "").trim();
  if (
    !placeOnly ||
    /^(행진|시위|집회)$/.test(placeOnly) ||
    placeOnly.length < 4
  ) {
    const tr = String(row.time_raw || "");
    const after = tr
      .replace(
        /^(?:[①②③④⑤\d.\s월화수목금토일()]*)?(?:\d{1,2}:\d{2}\s*[～∼~\-]?\s*(?:\d{1,2}:\d{2})?\s*)+/g,
        " ",
      )
      .trim();
    if (after.length >= 4) text = `${text} ${after}`;
  }
  const parts = text
    .split(/\s*(?:→|->|⇄|⟷|⇒|∼|~)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const start = placeTokens(parts[0] || "").filter((t) => !tokenizeNoise(t));
  const end = placeTokens(parts[parts.length - 1] || "").filter(
    (t) => !tokenizeNoise(t),
  );
  return { start, end, all: landmarkTokens(row) };
}

function tokensHit(as = [], bs = []) {
  const setB = new Set(bs);
  for (const a of as) {
    if (setB.has(a)) return true;
    for (const b of setB) {
      if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) {
        return true;
      }
    }
  }
  return false;
}

function sharedLandmarks(as = [], bs = []) {
  const out = [];
  const setB = new Set(bs);
  for (const a of as) {
    if (setB.has(a)) {
      out.push(a);
      continue;
    }
    for (const b of setB) {
      if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) {
        out.push(a);
        break;
      }
    }
  }
  return [...new Set(out)];
}

/**
 * Same-day SPATIC ↔ SMPA: treat assembly / pre_march / 시위 / 행진 as one family.
 * Events stay separate. Match if time is close AND (start OR end OR any landmark) overlaps.
 */
export function matchScore(target, donor) {
  const tIsEvent = target.record_type === "event";
  const dIsEvent = donor.record_type === "event";
  if (tIsEvent !== dIsEvent) {
    return { total: 0, tScore: 0, reason: "event_family_mismatch" };
  }

  const tScore = timeScore(target, donor);
  const A = endpointTokens(target);
  const B = endpointTokens(donor);
  const shared = sharedLandmarks(A.all, B.all);
  const startHit =
    tokensHit(A.start, B.start) ||
    tokensHit(A.start, B.end) ||
    tokensHit(A.start, B.all);
  const endHit =
    tokensHit(A.end, B.start) ||
    tokensHit(A.end, B.end) ||
    tokensHit(A.end, B.all);
  const anyLandmark = shared.some((t) => t.length >= 4);

  // Need at least one place anchor (출발지/도착지/공통 장소명)
  if (!startHit && !endHit && !anyLandmark) {
    return { total: 0, tScore, shared, startHit, endHit, reason: "no_place" };
  }

  const targetHasTime = extractTimes(target).starts.length > 0;
  const donorHasTime = extractTimes(donor).starts.length > 0;
  if (targetHasTime && donorHasTime && tScore < 18) {
    // >60분 차이면 같은 집회로 보지 않음
    return { total: 0, tScore, shared, startHit, endHit, reason: "time_far" };
  }
  // 한쪽만 시간 없으면 장소 근거가 더 필요할 때 (랜드마크 ≥4자)
  if ((!targetHasTime || !donorHasTime) && !anyLandmark && !startHit) {
    return { total: 0, tScore, shared, startHit, endHit, reason: "weak_notime" };
  }

  let total = 30;
  total += tScore;
  if (startHit) total += 28;
  if (endHit) total += 18;
  if (anyLandmark) total += 22;
  total += Math.min(24, shared.length * 8);
  return {
    total,
    tScore,
    shared,
    startHit,
    endHit,
    pScore: shared.length * 10,
    rScore: (startHit ? 15 : 0) + (endHit ? 10 : 0),
  };
}

function loadDonorAssemblies() {
  if (!fs.existsSync(DETAILS_DIR)) return [];
  const files = fs.readdirSync(DETAILS_DIR).filter((f) => f.endsWith(".json"));
  const donors = [];
  for (const f of files) {
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(path.join(DETAILS_DIR, f), "utf8"));
    } catch {
      continue;
    }
    if (meta.error) continue;
    const txtPath = path.join(DETAILS_DIR, f.replace(/\.json$/, ".txt"));
    const plain = fs.existsSync(txtPath)
      ? fs.readFileSync(txtPath, "utf8")
      : "";
    if (!plain) continue;
    const eventDate =
      meta.eventDate ||
      eventDateFromTitle(meta.title) ||
      meta.postDate ||
      "";
    if (eventDate && eventDate < DATA_START) continue;
    const source = meta.extract?.source || "pdf";
    const { assemblies } = assembliesToEventRows({
      boards: {
        boardNo: meta.boardNo,
        title: meta.title,
        postDate: meta.postDate,
        eventDate,
        sourceUrl: meta.sourceUrl || "",
      },
      sourcePlain: plain,
      parseSource: source === "html" ? "html" : source === "hwp" ? "hwp" : "pdf",
    });
    for (const a of assemblies) {
      if (!(a.personnel_raw || "").trim()) continue;
      // assembly / pre_march family only as donors for non-event fills;
      // events can still donate to event rows
      donors.push({
        ...a,
        event_date: a.event_date || eventDate,
        record_type: a.record_type || "assembly",
        _donorBoard: meta.boardNo,
        _donorTitle: meta.title || "",
      });
    }
  }
  return donors;
}

function indexByDate(donors) {
  const map = new Map();
  for (const d of donors) {
    const key = d.event_date || "";
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(d);
  }
  return map;
}

/** Pull free-text 인원 notes from SPATIC HTML body (bottom notes / event blobs). */
function loadSpaticPersonnelNotes() {
  if (!fs.existsSync(SPATIC_JSONL)) return new Map();
  const byPost = new Map();
  const text = fs.readFileSync(SPATIC_JSONL, "utf8");
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    const postId = String(rec.mgrSeq || "");
    if (!postId) continue;
    const plain = htmlToPlainText(rec.assemConts || "");
    const notes = [];
    for (const m of plain.matchAll(
      /(?:인\s*원|신고\s*인원)\s*[:：]?\s*([^\n]{0,120})/gi,
    )) {
      const raw = normalizeSpace(m[1] || "");
      const n = parsePersonnelCount(raw);
      if (n === "" && !/[\d,]/.test(raw)) continue;
      notes.push({
        personnel_raw: normalizePersonnelRaw(raw) || raw,
        personnel_count: n === "" ? "" : String(n),
        context: normalizeSpace(plain.slice(Math.max(0, m.index - 80), m.index + 120)),
      });
    }
    // also bare 「총 N명」 near bottom
    for (const m of plain.matchAll(/총\s*([\d,]+)\s*명/g)) {
      const raw = `총 ${m[1]}명`;
      notes.push({
        personnel_raw: normalizePersonnelRaw(raw),
        personnel_count: String(Number(String(m[1]).replace(/,/g, ""))),
        context: normalizeSpace(plain.slice(Math.max(0, m.index - 80), m.index + 80)),
      });
    }
    if (notes.length) byPost.set(postId, notes);
  }
  return byPost;
}

function fillFromSpaticBody(rows, emptyIdx, notesByPost) {
  let filled = 0;
  const samples = [];
  for (const i of emptyIdx) {
    const row = rows[i];
    if ((row.personnel_raw || "").trim()) continue;
    if (String(row.post_id || "").startsWith("smpa-")) continue;
    const notes = notesByPost.get(String(row.post_id)) || [];
    if (!notes.length) continue;

    const places = landmarkTokens(row);
    let best = null;
    for (const note of notes) {
      const ctxTokens = placeTokens(note.context).filter((t) => !tokenizeNoise(t));
      const shared = sharedLandmarks(places, ctxTokens);
      const score =
        shared.length * 20 +
        (note.personnel_count ? 5 : 0) +
        (places.length === 0 ? 10 : 0); // no place → take first note lightly for event rows
      if (shared.length === 0 && row.record_type !== "event") continue;
      if (!best || score > best.score) best = { note, score, shared };
    }
    if (!best || (row.record_type !== "event" && best.shared.length === 0)) {
      continue;
    }
    if (row.record_type !== "event" && best.score < 20) continue;

    rows[i] = {
      ...row,
      personnel_raw: best.note.personnel_raw,
      personnel_count: best.note.personnel_count,
    };
    filled += 1;
    if (samples.length < 15) {
      samples.push({
        post_id: row.post_id,
        event_date: row.event_date,
        place: (row.place_raw || "").slice(0, 50),
        personnel_raw: best.note.personnel_raw,
        via: "spatic_body",
        shared: best.shared,
      });
    }
  }
  return { filled, samples };
}

function donorKey(donor) {
  return `${donor._donorBoard || donor.post_id}|${donor.seq_no}|${donor.time_raw}|${donor.place_raw}|${donor.personnel_raw}`;
}

function normalizeEventRow(row) {
  const o = {};
  for (const c of EVENT_COLUMNS) o[c] = row[c] ?? "";
  return o;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log("Loading SMPA attachment assemblies as donors…");
  const donors = loadDonorAssemblies();
  const byDate = indexByDate(donors);
  console.log(
    `Donors with personnel: ${donors.length} across ${byDate.size} dates`,
  );

  console.log("Loading SPATIC body 인원 notes…");
  const notesByPost = loadSpaticPersonnelNotes();
  console.log(`SPATIC posts with 인원 notes: ${notesByPost.size}`);

  const { rows } = parseExistingCsv(OUT_EVENTS);
  const rowsBefore = rows.length;
  let emptyIdx = [];
  for (let i = 0; i < rows.length; i++) {
    if (!(rows[i].personnel_raw || "").trim()) emptyIdx.push(i);
  }
  console.log(`Empty personnel rows: ${emptyIdx.length}`);

  const bodyFill = fillFromSpaticBody(rows, emptyIdx, notesByPost);
  console.log(`Filled from SPATIC body: ${bodyFill.filled}`);

  emptyIdx = [];
  for (let i = 0; i < rows.length; i++) {
    if (!(rows[i].personnel_raw || "").trim()) emptyIdx.push(i);
  }

  const usedDonorKeys = new Set();
  const fills = [...bodyFill.samples];
  let filled = bodyFill.filled;
  let noDonorDate = 0;
  let noMatch = 0;

  for (const i of emptyIdx) {
    const target = rows[i];
    const date = target.event_date || "";
    const pool = byDate.get(date) || [];
    if (!pool.length) {
      noDonorDate += 1;
      continue;
    }

    let best = null;
    for (const donor of pool) {
      const key = donorKey(donor);
      const scored = matchScore(target, donor);
      if (scored.total < opts.minScore) continue;
      const penalty = usedDonorKeys.has(key) ? 4 : 0;
      const adj = scored.total - penalty;
      if (!best || adj > best.adj) {
        best = { donor, scored, donorKey: key, adj };
      }
    }

    if (!best) {
      noMatch += 1;
      continue;
    }

    const n = parsePersonnelCount(best.donor.personnel_raw);
    rows[i] = {
      ...target,
      personnel_raw: best.donor.personnel_raw,
      personnel_count: n === "" ? "" : String(n),
    };
    usedDonorKeys.add(best.donorKey);
    filled += 1;
    if (fills.length < 40) {
      fills.push({
        post_id: target.post_id,
        event_date: date,
        time_raw: target.time_raw,
        place: (target.place_raw || target.place_primary || "").slice(0, 60),
        personnel_raw: best.donor.personnel_raw,
        score: best.scored,
        via: "smpa_match",
        donor: {
          boardNo: best.donor._donorBoard,
          time_raw: best.donor.time_raw,
          place: (best.donor.place_raw || best.donor.place_primary || "").slice(
            0,
            60,
          ),
        },
      });
    }
  }

  // SPATIC에 없는 SMPA 집회(인원 있음) → 새 행
  console.log(
    `Inserting SMPA-only assemblies from ${SPATIC_COVERAGE_START}…`,
  );
  let insertedCount = 0;
  const insertSamples = [];
  {
    const existingByDate = new Map();
    for (const r of rows) {
      const d = r.event_date || "";
      if (!d) continue;
      if (!existingByDate.has(d)) existingByDate.set(d, []);
      existingByDate.get(d).push(r);
    }
    const seenKeys = new Set(
      rows
        .filter((r) => String(r.post_id || "").startsWith("smpa-"))
        .map(
          (r) =>
            `${r.post_id}|${r.seq_no}|${r.time_raw}|${r.place_raw}|${r.personnel_raw}`,
        ),
    );

    for (const donor of donors) {
      const date = donor.event_date || "";
      if (!date || date < SPATIC_COVERAGE_START) continue;
      if (!(donor.personnel_raw || "").trim()) continue;
      const key = donorKey(donor);
      if (usedDonorKeys.has(key) || seenKeys.has(key)) continue;

      const existing = existingByDate.get(date) || [];
      let covered = false;
      for (const row of existing) {
        if (matchScore(row, donor).total >= opts.minScore) {
          covered = true;
          break;
        }
      }
      if (covered) continue;

      const row = normalizeEventRow({
        ...donor,
        post_id: donor.post_id || `smpa-${donor._donorBoard}`,
        record_type: donor.record_type || "assembly",
        personnel_count:
          donor.personnel_count != null && donor.personnel_count !== ""
            ? String(donor.personnel_count)
            : (() => {
                const n = parsePersonnelCount(donor.personnel_raw);
                return n === "" ? "" : String(n);
              })(),
      });
      rows.push(row);
      seenKeys.add(key);
      if (!existingByDate.has(date)) existingByDate.set(date, []);
      existingByDate.get(date).push(row);
      insertedCount += 1;
      if (insertSamples.length < 25) {
        insertSamples.push({
          post_id: row.post_id,
          event_date: date,
          time_raw: row.time_raw,
          place: (row.place_raw || "").slice(0, 60),
          personnel_raw: row.personnel_raw,
          via: "smpa_insert",
        });
      }
    }
  }
  console.log(`Inserted SMPA-only rows: ${insertedCount}`);

  // Sort newest first
  rows.sort((a, b) => {
    const d = String(b.event_date).localeCompare(String(a.event_date));
    if (d) return d;
    return String(a.post_id).localeCompare(String(b.post_id));
  });

  const stillEmpty = rows.filter((r) => !(r.personnel_raw || "").trim()).length;
  const withPersonnel = rows.filter((r) => (r.personnel_raw || "").trim()).length;
  const report = {
    finishedAt: new Date().toISOString(),
    minScore: opts.minScore,
    donors: donors.length,
    donorDates: byDate.size,
    spaticBodyPosts: notesByPost.size,
    rowsBefore,
    rowsAfter: rows.length,
    filled,
    filledFromSpaticBody: bodyFill.filled,
    filledFromSmpaMatch: filled - bodyFill.filled,
    insertedSmpaOnly: insertedCount,
    noDonorDate,
    noMatch,
    stillEmpty,
    withPersonnel,
    coveragePct: Number(((100 * withPersonnel) / rows.length).toFixed(1)),
    samples: [...fills.slice(0, 15), ...insertSamples],
  };
  console.log(JSON.stringify({ ...report, samples: report.samples.slice(0, 12) }, null, 2));

  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  if (!opts.dryRun) {
    const outRows = rows.map(normalizeEventRow);
    fs.writeFileSync(OUT_EVENTS, toCsv(EVENT_COLUMNS, outRows));
    console.log(
      `Wrote ${OUT_EVENTS} (${outRows.length} rows; +${insertedCount} smpa-only; personnel ${withPersonnel}/${outRows.length})`,
    );
  } else {
    console.log("Dry-run: CSV not written");
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
