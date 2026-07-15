#!/usr/bin/env node
/**
 * Parse SPATIC raw JSONL → crowding-oriented CSV.
 *
 * Usage:
 *   node scripts/parse-spatic-assem.mjs
 *   node scripts/parse-spatic-assem.mjs --input data/spatic/raw/assem.jsonl
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  crowdFocusPoints,
  DETAIL_URL,
  eventDateFromTitle,
  extractMarchFromPlace,
  formatPostDate,
  htmlToPlainText,
  normalizeSpace,
  parseTimeCell,
  placePrimaryFrom,
  splitLabeledEventFields,
  toCsv,
} from "./lib/spatic-assem.mjs";
import { parsePersonnelCount } from "./lib/smpa-assem.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT = path.join(ROOT, "data", "spatic", "raw", "assem.jsonl");
const OUT_EVENTS = path.join(ROOT, "data", "spatic", "assem-events.csv");
const OUT_POSTS = path.join(ROOT, "data", "spatic", "assem-posts.csv");
const OUT_REPORT = path.join(ROOT, "data", "spatic", "parse-report.json");

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
  "source_url",
];

function parseArgs(argv) {
  const opts = { input: DEFAULT_INPUT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input") opts.input = path.resolve(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/parse-spatic-assem.mjs [--input path/to/assem.jsonl]",
      );
      process.exit(0);
    }
  }
  return opts;
}

function splitSections(plain) {
  const text = plain.replace(/\r/g, "");
  // Normalize spaced markers: □ 집 회 / □ 행 사
  const marked = text.replace(/□\s*집\s*회/g, "\n§ASSEMBLY§\n").replace(
    /□\s*행\s*사/g,
    "\n§EVENT§\n",
  );
  const parts = marked.split(/\n§(ASSEMBLY|EVENT)§\n/);
  const sections = { assemblies: [], events: [] };
  // parts[0] is preamble; then pairs of (type, body)
  for (let i = 1; i < parts.length; i += 2) {
    const type = parts[i];
    const body = (parts[i + 1] || "").trim();
    if (type === "ASSEMBLY") sections.assemblies.push(body);
    else if (type === "EVENT") sections.events.push(body);
  }
  return sections;
}

function isHeaderLine(line) {
  const s = normalizeSpace(line).replace(/\s/g, "");
  return (
    /^(연번|연번시간|연번시간장소)/.test(s) ||
    s === "시간" ||
    s === "장소" ||
    s === "장소및행진" ||
    /^연\s*번/.test(normalizeSpace(line))
  );
}

function isPreMarchMarker(line) {
  return /【\s*사전\s*집회/.test(line);
}

function isCircledSeq(line) {
  return /^[①②③④⑤⑥⑦⑧⑨⑩]/.test(normalizeSpace(line));
}

function isMainSeqLine(line) {
  const t = normalizeSpace(line);
  if (/^\d{1,3}$/.test(t)) return true;
  if (/^\d{1,3}\t/.test(line)) return true;
  // `1 12:00∼13:00 …` same line
  return /^\d{1,3}\s+\d{1,2}:\d{2}/.test(t);
}

function collectBlock(lines, startIdx, { stopOnCircled = false } = {}) {
  const buf = [];
  let j = startIdx;
  while (j < lines.length) {
    if (isPreMarchMarker(lines[j])) break;
    if (isMainSeqLine(lines[j])) break;
    if (stopOnCircled && isCircledSeq(lines[j])) break;
    buf.push(lines[j]);
    j += 1;
  }
  return { text: buf.join("\n"), next: j };
}

/**
 * Parse assembly table body into rows.
 * Handles tab-separated cells and 【사전 집회·행진】 nested blocks.
 */
function parseAssemblyBody(body, baseMeta) {
  const rows = [];
  const lines = body
    .split("\n")
    .map((l) => l.replace(/\t+$/, ""))
    .filter((l) => normalizeSpace(l).length > 0);

  let i = 0;
  while (i < lines.length && isHeaderLine(lines[i])) i += 1;

  let currentParentSeq = "";
  let inPreMarch = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = normalizeSpace(line);

    if (isPreMarchMarker(line)) {
      inPreMarch = true;
      i += 1;
      continue;
    }

    if (inPreMarch && isCircledSeq(line)) {
      const head = trimmed.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "");
      const { text, next } = collectBlock(lines, i + 1, {
        stopOnCircled: true,
      });
      const cellText = [head, text].filter(Boolean).join("\n");
      rows.push(
        buildAssemblyRow({
          ...baseMeta,
          record_type: "pre_march",
          seq_no: "",
          cellText,
          is_pre_march: true,
          parent_seq_no: currentParentSeq,
        }),
      );
      i = next;
      continue;
    }

    if (isMainSeqLine(line)) {
      inPreMarch = false;
      let seq_no = "";
      let rest = "";
      const only = trimmed.match(/^(\d{1,3})$/);
      const withRest = trimmed.match(/^(\d{1,3})\s+([\s\S]+)$/);
      if (only) {
        seq_no = only[1];
        const collected = collectBlock(lines, i + 1);
        rest = collected.text;
        i = collected.next;
      } else if (withRest) {
        seq_no = withRest[1];
        const collected = collectBlock(lines, i + 1);
        rest = [withRest[2], collected.text].filter(Boolean).join("\n");
        i = collected.next;
      } else if (/^\d{1,3}\t/.test(line)) {
        const parts = line.split("\t");
        seq_no = normalizeSpace(parts[0]);
        const collected = collectBlock(lines, i + 1);
        rest = [parts.slice(1).join("\t"), collected.text]
          .filter(Boolean)
          .join("\n");
        i = collected.next;
      } else {
        i += 1;
        continue;
      }

      currentParentSeq = seq_no;
      rows.push(
        buildAssemblyRow({
          ...baseMeta,
          record_type: "assembly",
          seq_no,
          cellText: rest,
          is_pre_march: false,
          parent_seq_no: "",
        }),
      );
      continue;
    }

    i += 1;
  }

  return rows;
}

function splitTimePlace(cellText) {
  const text = String(cellText || "").trim();
  // Tab-separated time | place
  if (text.includes("\t")) {
    const parts = text.split("\t").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { timePart: parts[0], placePart: parts.slice(1).join(" ") };
    }
    if (parts.length === 1) {
      return guessTimePlace(parts[0]);
    }
  }
  return guessTimePlace(text);
}

function guessTimePlace(text) {
  const t = normalizeSpace(text);
  // time range at start
  const m = t.match(
    /^((?:[①②③④⑤⑥⑦⑧⑨⑩]\s*)?\d{1,2}:\d{2}(?:\s*[∼~\-–—]\s*(?:\d{1,2}:\d{2})?)?(?:\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*\d{1,2}:\d{2}(?:\s*[∼~\-–—]\s*(?:\d{1,2}:\d{2})?)?)*)\s+(.+)$/,
  );
  if (m) return { timePart: m[1], placePart: m[2] };
  return { timePart: "", placePart: t };
}

function buildAssemblyRow({
  post_id,
  post_date,
  event_date,
  post_title,
  source_url,
  record_type,
  seq_no,
  cellText,
  is_pre_march,
  parent_seq_no,
}) {
  let { timePart, placePart } = splitTimePlace(cellText);
  // Recover when place collapsed to "행진" and venue leaked into timePart
  if (
    !placePart ||
    /^(행진|시위|집회)$/.test(normalizeSpace(placePart))
  ) {
    const recovered = guessTimePlace(normalizeSpace(cellText));
    if (recovered.placePart && !/^(행진|시위|집회)$/.test(normalizeSpace(recovered.placePart))) {
      timePart = recovered.timePart || timePart;
      placePart = recovered.placePart;
    } else {
      const fromTime = guessTimePlace(normalizeSpace(timePart));
      if (
        fromTime.placePart &&
        !/^(행진|시위|집회)$/.test(normalizeSpace(fromTime.placePart))
      ) {
        timePart = fromTime.timePart || timePart;
        placePart = fromTime.placePart;
      }
    }
  }

  const times = parseTimeCell(timePart);
  const marchInfo = extractMarchFromPlace(placePart);
  const place_raw = normalizeSpace(
    marchInfo.place_without_march || placePart,
  );
  let place_primary = placePrimaryFrom(place_raw);
  if (/^(행진|시위|집회)$/.test(place_primary)) {
    place_primary = placePrimaryFrom(place_raw.replace(/^(행진|시위|집회)\s*/g, ""));
  }
  const parse_ok = Boolean(place_primary || times.time_start);

  return {
    post_id,
    post_date,
    event_date,
    post_title,
    record_type,
    seq_no,
    time_raw: (() => {
      const m = normalizeSpace(timePart).match(
        /^((?:[①②③④⑤⑥⑦⑧⑨⑩]\s*)?\d{1,2}:\d{2}(?:\s*[∼~\-–—]\s*(?:\d{1,2}:\d{2})?)*)/,
      );
      return times.time_raw || (m ? m[1] : normalizeSpace(timePart));
    })(),
    time_start: times.time_start,
    time_end: times.time_end,
    place_raw,
    place_primary,
    venue_raw: "",
    march_raw: marchInfo.march_raw,
    march_start: marchInfo.march_start,
    march_end: marchInfo.march_end,
    march_waypoints: marchInfo.march_waypoints,
    is_pre_march: is_pre_march ? "true" : "false",
    parent_seq_no: parent_seq_no || "",
    event_name: "",
    personnel_raw: "",
    personnel_count: "",
    control_time_raw: "",
    control_section_raw: "",
    control_method_raw: "",
    crowd_focus_points: crowdFocusPoints({
      place_primary,
      march_start: marchInfo.march_start,
      march_end: marchInfo.march_end,
      march_waypoints: marchInfo.march_waypoints,
    }),
    parse_ok: parse_ok ? "true" : "false",
    source_url,
  };
}

function parseEventBlocks(body, baseMeta) {
  const rows = [];
  // Split multiple events by [name] or 『name』 headers
  const chunks = [];
  let cur = [];
  for (const line of body.split("\n")) {
    const t = normalizeSpace(line);
    const isHeader = /^\[[^\]]+\]/.test(t) || /^『[^』]+』/.test(t);
    if (isHeader && cur.some((l) => normalizeSpace(l).length > 0)) {
      chunks.push(cur.join("\n"));
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) chunks.push(cur.join("\n"));

  for (const chunk of chunks) {
    const text = chunk.trim();
    if (!text) continue;

    const fields = splitLabeledEventFields(text);
    // Skip empty header-only stubs (e.g. "-일시:" with no values)
    if (
      !fields.datetime &&
      !fields.course &&
      !fields.venue &&
      !fields.personnel &&
      !/\d{1,2}\s*:\s*\d{2}/.test(text)
    ) {
      continue;
    }

    const nameMatch =
      text.match(/\[([^\]]+)\]/) || text.match(/『([^』]+)』/);
    let event_name = nameMatch ? normalizeSpace(nameMatch[1]) : "";

    const datetime = fields.datetime;
    let course = fields.course;
    const venue = fields.venue;
    const personnel = fields.personnel;
    let controlTime = fields.control_time;
    let controlSection = fields.control_section;
    const controlMethod = fields.control_method;

    // Course must not swallow the next event title
    const nextTitleAt = course.search(/\s*『/);
    if (nextTitleAt > 0) course = normalizeSpace(course.slice(0, nextTitleAt));

    const times = parseTimeCell(datetime);
    const placeSource = course || venue || "";
    const marchFromCourse = placeSource
      ? extractMarchFromPlace(`※행진:${placeSource}`)
      : {
          march_raw: "",
          march_start: "",
          march_end: "",
          march_waypoints: "",
          place_without_march: "",
        };

    const place_raw = normalizeSpace(
      (placeSource || "")
        .replace(/『[^』]+』/g, "")
        .replace(/\*\s*(?:하프|10K|5K)[\s\S]*$/i, "")
        .replace(/인\s*원\s*[:：][\s\S]*$/i, ""),
    );
    const place_primary =
      placePrimaryFrom(venue) ||
      placePrimaryFrom(marchFromCourse.place_without_march || place_raw) ||
      placePrimaryFrom(place_raw) ||
      event_name;

    if (!controlSection && controlMethod) {
      controlSection = controlMethod;
    }
    if (
      controlSection &&
      place_raw &&
      normalizeSpace(controlSection) === normalizeSpace(place_raw)
    ) {
      controlSection = fields.control_section || "";
    }

    const parse_ok = Boolean(
      event_name || place_primary || times.time_start || datetime,
    );

    rows.push({
      post_id: baseMeta.post_id,
      post_date: baseMeta.post_date,
      event_date: baseMeta.event_date,
      post_title: baseMeta.post_title,
      record_type: "event",
      seq_no: "",
      time_raw: datetime || times.time_raw,
      time_start: times.time_start,
      time_end: times.time_end,
      place_raw: place_raw || venue,
      place_primary,
      venue_raw: venue,
      march_raw: place_raw ? normalizeSpace(`※행진:${place_raw}`) : "",
      march_start: marchFromCourse.march_start,
      march_end: marchFromCourse.march_end,
      march_waypoints: marchFromCourse.march_waypoints,
      is_pre_march: "false",
      parent_seq_no: "",
      event_name,
      personnel_raw: personnel,
      personnel_count: (() => {
        const n = parsePersonnelCount(personnel);
        return n === "" ? "" : String(n);
      })(),
      control_time_raw: normalizeSpace(controlTime),
      control_section_raw: controlSection,
      control_method_raw: controlMethod,
      crowd_focus_points: crowdFocusPoints({
        place_primary,
        march_start: marchFromCourse.march_start,
        march_end: marchFromCourse.march_end,
        march_waypoints: marchFromCourse.march_waypoints,
      }),
      parse_ok: parse_ok ? "true" : "false",
      source_url: baseMeta.source_url,
    });
  }
  return rows;
}

function parsePost(record) {
  const post_id = String(record.mgrSeq);
  const post_title = record.assemTitle || "";
  const post_date =
    record.post_date || formatPostDate(record.lastMdfyDat);
  const event_date = eventDateFromTitle(post_title, record.lastMdfyDat);
  const source_url = record.source_url || DETAIL_URL(post_id);
  const baseMeta = { post_id, post_date, event_date, post_title, source_url };

  const plain = htmlToPlainText(record.assemConts || "");
  const sections = splitSections(plain);

  const eventRows = [];
  for (const body of sections.assemblies) {
    eventRows.push(...parseAssemblyBody(body, baseMeta));
  }
  for (const body of sections.events) {
    eventRows.push(...parseEventBlocks(body, baseMeta));
  }

  // Fallback: if nothing parsed but body has content, emit one failed row
  if (eventRows.length === 0 && plain.length > 20) {
    eventRows.push({
      ...baseMeta,
      record_type: "assembly",
      seq_no: "",
      time_raw: "",
      time_start: "",
      time_end: "",
      place_raw: normalizeSpace(plain).slice(0, 500),
      place_primary: "",
      venue_raw: "",
      march_raw: "",
      march_start: "",
      march_end: "",
      march_waypoints: "",
      is_pre_march: "false",
      parent_seq_no: "",
      event_name: "",
      personnel_raw: "",
      personnel_count: "",
      control_time_raw: "",
      control_section_raw: "",
      control_method_raw: "",
      crowd_focus_points: "",
      parse_ok: "false",
    });
  }

  const postMeta = {
    post_id,
    post_date,
    event_date,
    post_title,
    assembly_rows: eventRows.filter((r) => r.record_type === "assembly").length,
    pre_march_rows: eventRows.filter((r) => r.record_type === "pre_march")
      .length,
    event_rows: eventRows.filter((r) => r.record_type === "event").length,
    source_url,
  };

  return { eventRows, postMeta };
}

function loadJsonl(file) {
  const text = fs.readFileSync(file, "utf8");
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  return rows;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.input)) {
    console.error(`Input not found: ${opts.input}`);
    console.error("Run: npm run crawl:spatic-assem");
    process.exit(1);
  }

  const posts = loadJsonl(opts.input);
  const allEvents = [];
  const allPosts = [];
  let ok = 0;
  let fail = 0;
  let emptyFocus = 0;

  for (const post of posts) {
    const { eventRows, postMeta } = parsePost(post);
    allPosts.push(postMeta);
    for (const row of eventRows) {
      allEvents.push(row);
      if (row.parse_ok === "true") ok += 1;
      else fail += 1;
      if (!row.crowd_focus_points) emptyFocus += 1;
    }
  }

  fs.mkdirSync(path.dirname(OUT_EVENTS), { recursive: true });
  fs.writeFileSync(OUT_EVENTS, toCsv(allEvents, EVENT_COLUMNS));
  fs.writeFileSync(OUT_POSTS, toCsv(allPosts, POST_COLUMNS));

  const report = {
    parsed_at: new Date().toISOString(),
    input: path.relative(ROOT, opts.input),
    posts: posts.length,
    event_rows: allEvents.length,
    by_type: {
      assembly: allEvents.filter((r) => r.record_type === "assembly").length,
      pre_march: allEvents.filter((r) => r.record_type === "pre_march").length,
      event: allEvents.filter((r) => r.record_type === "event").length,
    },
    parse_ok: ok,
    parse_fail: fail,
    empty_crowd_focus_points: emptyFocus,
    ok_rate: allEvents.length
      ? Number((ok / allEvents.length).toFixed(4))
      : 0,
    outputs: {
      events: path.relative(ROOT, OUT_EVENTS),
      posts: path.relative(ROOT, OUT_POSTS),
    },
  };
  fs.writeFileSync(OUT_REPORT, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(report, null, 2));
}

main();
