/** Shared helpers for SPATIC 집회·통제정보 crawl/parse. */

export const SPATIC_BASE = "https://www.spatic.go.kr/spatic";
export const LIST_URL = `${SPATIC_BASE}/assem/getList.json`;
export const DETAIL_URL = (mgrSeq) =>
  `${SPATIC_BASE}/assem/getInfoView.do?mgrSeq=${mgrSeq}`;

export const DEFAULT_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Referer: `${SPATIC_BASE}/main/assem.do`,
  "User-Agent":
    "Mozilla/5.0 (compatible; YeoyuroSpaticCrawl/1.0; +https://github.com/)",
  Accept: "application/json, text/plain, */*",
};

/** Keep 행사/집회 posts; drop roadworks and test posts. */
export function isAssemblyPostTitle(title = "") {
  const t = String(title).replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (/\(?\s*테스트\s*\)?/.test(t) || t.includes("테스트")) return false;
  if (t.includes("도로공사")) return false;
  return /행사\s*및\s*집회|집회\s*및\s*행사/.test(t);
}

export function formatPostDate(lastMdfyDat) {
  const s = String(lastMdfyDat || "");
  if (s.length < 8) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Title like `7월 13일 (월)` + year from lastMdfyDat → YYYY-MM-DD */
export function eventDateFromTitle(title, lastMdfyDat) {
  const year = String(lastMdfyDat || "").slice(0, 4);
  const m = String(title || "").match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (!year || !m) return "";
  return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchAssemList({ limit, offset, signal } = {}) {
  const body = new URLSearchParams({
    limit: String(limit ?? 20),
    offset: String(offset ?? 0),
  });
  const res = await fetch(LIST_URL, {
    method: "POST",
    headers: DEFAULT_HEADERS,
    body,
    signal,
  });
  if (!res.ok) {
    throw new Error(`getList.json HTTP ${res.status} at offset=${offset}`);
  }
  return res.json();
}

const ENTITY_MAP = {
  nbsp: " ",
  sim: "∼",
  rarr: "→",
  larr: "←",
  harr: "↔",
  lrarr: "↔",
  thinsp: " ",
  ensp: " ",
  emsp: " ",
  mdash: "—",
  ndash: "–",
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
  bull: "•",
  middot: "·",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  hellip: "…",
};

export function decodeHtmlEntities(input = "") {
  return String(input)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (full, name) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(ENTITY_MAP, key)
        ? ENTITY_MAP[key]
        : full;
    });
}

/** Strip HWP junk / tags into tab/newline text suitable for table parsing. */
export function htmlToPlainText(html = "") {
  let s = String(html);
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = decodeHtmlEntities(s);
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|li|h[1-6])>/gi, "\n");
  s = s.replace(/<\/tr>/gi, "\n");
  s = s.replace(/<\/t[dh]>/gi, "\t");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/\u00a0/g, " ");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s.trim();
}

export function normalizeSpace(s = "") {
  return String(s).replace(/\s+/g, " ").trim();
}

/** Split march path on → / ↔ / ⇄ / ⟺ */
export function splitMarchPath(raw = "") {
  const cleaned = normalizeSpace(raw)
    .replace(/^※\s*행진\s*[:：]?\s*/i, "")
    .replace(/^행진\s*[:：]\s*/i, "");
  if (!cleaned) {
    return { march_start: "", march_end: "", march_waypoints: "", tokens: [] };
  }
  const tokens = cleaned
    .split(/\s*(?:→|↔|⇄|⟷|⟺|->|<->)\s*/)
    .map((t) =>
      normalizeSpace(t)
        .replace(/\(\d{1,2}:\d{2}\s*出[^)]*\)/g, "")
        .replace(/\([^)]*(?:km|개차로|이면도로)[^)]*\)/g, "")
        .trim(),
    )
    .filter(Boolean);
  if (tokens.length === 0) {
    return { march_start: "", march_end: "", march_waypoints: "", tokens: [] };
  }
  const march_start = tokens[0] || "";
  const march_end = tokens[tokens.length - 1] || "";
  const mid = tokens.slice(1, -1);
  return {
    march_start,
    march_end,
    march_waypoints: mid.join("|"),
    tokens,
  };
}

/**
 * Parse time cell like `①08:40∼09:00 ②15:00∼16:00` or `13:00∼`.
 * Returns first range as start/end; full string as raw.
 */
export function parseTimeCell(raw = "") {
  const time_raw = normalizeSpace(raw).replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, " ").trim();
  const ranges = [
    ...time_raw.matchAll(
      /(\d{1,2}):(\d{2})\s*[∼~\-–—]\s*(?:(\d{1,2}):(\d{2}))?/g,
    ),
  ];
  if (ranges.length === 0) {
    const single = time_raw.match(/(\d{1,2}):(\d{2})/);
    if (!single) return { time_raw: normalizeSpace(raw), time_start: "", time_end: "" };
    const time_start = `${single[1].padStart(2, "0")}:${single[2]}`;
    return { time_raw: normalizeSpace(raw), time_start, time_end: "" };
  }
  const first = ranges[0];
  const time_start = `${first[1].padStart(2, "0")}:${first[2]}`;
  const time_end =
    first[3] != null ? `${first[3].padStart(2, "0")}:${first[4]}` : "";
  return { time_raw: normalizeSpace(raw), time_start, time_end };
}

export function extractMarchFromPlace(placeText = "") {
  const text = String(placeText);
  const marchMatch = text.match(
    /※\s*행진\s*[:：]?\s*([^\n※]+(?:\n[ \t]+[^\n※]+)*)/i,
  );
  const march_raw = marchMatch ? normalizeSpace(marchMatch[0]) : "";
  let marchParts = splitMarchPath(marchMatch ? marchMatch[1] : "");
  let place_without_march = text
    .replace(/※\s*행진\s*[:：]?[\s\S]*/i, "")
    .replace(/【\s*사전\s*집회[·･・]?\s*행진\s*】/g, "")
    .trim();

  // If no ※행진 but place itself is a path (→/⇄), derive march tokens from it.
  if (
    !marchParts.tokens.length &&
    /→|↔|⇄|⟷|⟺|->|<->/.test(place_without_march)
  ) {
    marchParts = splitMarchPath(place_without_march);
  }

  return {
    place_without_march: normalizeSpace(place_without_march),
    march_raw,
    ...marchParts,
  };
}

/** Primary place: before first arrow if present, else whole place. */
export function placePrimaryFrom(place = "") {
  const p = normalizeSpace(place);
  if (!p) return "";
  const parts = p.split(/\s*(?:→|↔|⇄|⟷|⟺|->|<->)\s*/);
  return normalizeSpace(parts[0] || p);
}

export function crowdFocusPoints({
  place_primary,
  march_start,
  march_end,
  march_waypoints,
}) {
  const fromWaypoints = String(march_waypoints || "")
    .split("|")
    .map(normalizeSpace)
    .filter(Boolean);
  const pts = [place_primary, march_start, ...fromWaypoints, march_end]
    .map(normalizeSpace)
    .filter((p) => p && isCleanFocusToken(p));
  return [...new Set(pts)].join(";");
}

/** Drop tokens that are clearly not places (인원/코스 설명 조각 등). */
export function isCleanFocusToken(token = "") {
  const t = normalizeSpace(token);
  if (!t || t.length < 2) return false;
  if (/인\s*원|교통통제|^\*|^『|^」|하프\s*,|10K\s*:|5K\s*:/i.test(t))
    return false;
  if (/^\d{2,4}\.\d{1,2}\.\d{1,2}/.test(t)) return false;
  if (/^○|^◦|^•/.test(t)) return false;
  return true;
}

/**
 * Split a flattened 행사 blob into labeled fields even when they share one line.
 * Handles: `-일시:`, `※ 교통통제:`, `• 인 원:`, `◦코스:`, `/ 교통통제 :` etc.
 */
export function splitLabeledEventFields(text = "") {
  const by = splitLabeledEventFieldsOnce(text);

  if (!by.datetime) {
    const src = normalizeSpace(
      decodeHtmlEntities(String(text))
        .replace(/\u2019/g, "'")
        .replace(/^[''′]\s*/, ""),
    );
    const inline = src.match(
      /^(.+?)(?:\s*[※/]\s*교통통제\s*[:：]?\s*|\s*\/\s*교통통제\s*[:：]?\s*|\s*\(\s*교통통제\s*[:：]?\s*)(.+)$/i,
    );
    if (inline) {
      by.datetime = normalizeSpace(inline[1]);
      const rest = normalizeSpace(inline[2]);
      const again = splitLabeledEventFieldsOnce(
        `교통통제: ${rest}`,
      );
      by.control_time = by.control_time || again.control_time || cleanControlTime(rest);
      by.personnel = by.personnel || again.personnel;
      by.course = by.course || again.course;
      by.venue = by.venue || again.venue;
      by.control_section = by.control_section || again.control_section;
      by.control_method = by.control_method || again.control_method;
    } else {
      by.datetime = src;
    }
  }

  // If datetime still glued with other fields, re-split once
  if (
    by.datetime &&
    /인\s*원|코\s*스|교통통제|(?:^|\s)장소\s*[:：]/.test(by.datetime)
  ) {
    const again = splitLabeledEventFieldsOnce(by.datetime);
    by.datetime = again.datetime || by.datetime;
    by.control_time = by.control_time || again.control_time;
    by.personnel = by.personnel || again.personnel;
    by.course = by.course || again.course;
    by.venue = by.venue || again.venue;
    by.control_section = by.control_section || again.control_section;
    by.control_method = by.control_method || again.control_method;
  }

  // Peel 「※ 교통통제 05:00」(colon optional) still glued to datetime
  if (by.datetime) {
    const glued = String(by.datetime).match(
      /^(.*?)(?:\s*[※]\s*교통통제\s*[:：]?\s*|\s*\/\s*교통통제\s*[:：]?\s*|\s*\(\s*교통통제\s*[:：]?\s*)(.+)$/i,
    );
    if (glued) {
      by.datetime = normalizeSpace(glued[1]);
      if (!by.control_time) {
        by.control_time = normalizeSpace(glued[2]);
      }
    }
  }

  by.datetime = cleanEventDatetime(by.datetime);
  by.control_time = cleanControlTime(by.control_time);
  by.personnel = normalizeSpace(
    String(by.personnel || "").replace(/^[:：]\s*/, ""),
  );
  by.course = normalizeSpace(by.course);
  by.venue = normalizeSpace(by.venue);
  by.control_section = normalizeSpace(by.control_section);
  by.control_method = normalizeSpace(by.control_method);
  by.rest = "";
  return by;
}

/** One-pass labeled split without recursive re-entry. */
function splitLabeledEventFieldsOnce(text = "") {
  const src = normalizeSpace(
    decodeHtmlEntities(String(text))
      .replace(/\u2019/g, "'")
      .replace(/^[''′]\s*/, ""),
  );
  const labelAlt =
    "일시|일\\s*시|행사일시|교통통제|통제일시|인\\s*원|코\\s*스|대회코스|장소|통제구간|구간|통제방법|통제";
  // Allow space after ※/• and optional leading dash on labels
  const boundary = new RegExp(
    `(?:^|[※•◦○/（(]|\\s[-–—]\\s*|\\s)(?:[-–—•◦○]\\s*)?\\s*(${labelAlt})\\s*[:：]\\s*`,
    "gi",
  );
  const by = {
    datetime: "",
    control_time: "",
    personnel: "",
    course: "",
    venue: "",
    control_section: "",
    control_method: "",
  };
  const matches = [...src.matchAll(boundary)];
  if (matches.length === 0) {
    return by;
  }
  const firstIdx = matches[0].index ?? 0;
  const leading = normalizeSpace(src.slice(0, firstIdx));
  let hasDatetimeLabel = false;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const key = normalizeSpace(m[1]).replace(/\s+/g, "");
    const start = (m.index ?? 0) + m[0].length;
    const end =
      i + 1 < matches.length ? (matches[i + 1].index ?? src.length) : src.length;
    let value = normalizeSpace(src.slice(start, end));
    // Only strip a wrapping outer paren pair, not duration notes like (4시간)
    if (/^[（(]/.test(value) && /[）)]$/.test(value)) {
      value = normalizeSpace(value.slice(1, -1));
    }
    if (!value) continue;
    if (key === "일시" || key === "행사일시") {
      hasDatetimeLabel = true;
      by.datetime = value; // labeled 일시 wins over leading title
    } else if (key === "교통통제" || key === "통제일시")
      by.control_time = by.control_time || value;
    else if (key === "인원") by.personnel = by.personnel || value;
    else if (key === "코스" || key === "대회코스") by.course = by.course || value;
    else if (key === "장소") by.venue = by.venue || value;
    else if (key === "통제구간" || key === "구간")
      by.control_section = by.control_section || value;
    else if (key === "통제" || key === "통제방법") {
      if (/\d{1,2}:\d{2}/.test(value) && !/전면통제|부분통제|차로/.test(value)) {
        by.control_time = by.control_time || value;
      } else {
        by.control_method = by.control_method || value;
      }
    }
  }

  // Bare leading datetime only when no explicit 일시 label (and not a title-only line)
  if (!hasDatetimeLabel && leading) {
    const looksLikeTitleOnly =
      /^[『\[]/.test(leading) && !/\d{1,2}\s*:\s*\d{2}/.test(leading);
    if (!looksLikeTitleOnly) by.datetime = leading;
  }
  return by;
}

/** Keep only date + event time window in time_raw. */
export function cleanEventDatetime(raw = "") {
  let s = normalizeSpace(decodeHtmlEntities(raw))
    .replace(/^[''′]\s*/, "")
    .replace(/^[:：]\s*/, "");
  // Cut at first clearly non-datetime field marker left behind
  s = s.split(
    /\s*(?:※\s*교통통제|\/\s*교통통제|(?:^|\s)[-–—•◦○]\s*(?:인\s*원|코\s*스|장소|구간|통제)|(?:^|\s)(?:인\s*원|코\s*스)\s*[:：])/i,
  )[0];
  s = normalizeSpace(s);
  // Prefer compact form: date part + first HH:MM~HH:MM
  const datePart =
    s.match(
      /(?:20)?\d{2}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2}\s*\.?\s*(?:\([^)]*\))?/,
    )?.[0] ||
    s.match(/\d{1,2}\s*\.\s*\d{1,2}\s*\.?\s*\([^)]*\)/)?.[0] ||
    "";
  const timePart = s.match(
    /(\d{1,2})\s*:\s*(\d{2})\s*(?:出)?\s*[∼~\-–—]\s*(?:(\d{1,2})\s*:\s*(\d{2}))?/,
  );
  if (datePart && timePart) {
    const start = `${timePart[1].padStart(2, "0")}:${timePart[2]}`;
    const end = timePart[3]
      ? `${timePart[3].padStart(2, "0")}:${timePart[4]}`
      : "";
    return normalizeSpace(
      `${normalizeSpace(datePart.replace(/\s+/g, ""))} ${start}${end ? `~${end}` : ""}`,
    );
  }
  if (timePart) {
    const start = `${timePart[1].padStart(2, "0")}:${timePart[2]}`;
    const end = timePart[3]
      ? `${timePart[3].padStart(2, "0")}:${timePart[4]}`
      : "";
    return `${start}${end ? `~${end}` : ""}`;
  }
  return s;
}

export function cleanControlTime(raw = "") {
  let s = normalizeSpace(decodeHtmlEntities(raw)).replace(/^[:：]\s*/, "");
  if (!s) return "";
  // Drop trailing 인원/코스/장소 if glued
  s = s.split(
    /\s*(?:[-–—•◦○]\s*)?(?:인\s*원|코\s*스|장소|구간)\s*[:：]/i,
  )[0];
  return normalizeSpace(s);
}

export function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((row) =>
    columns.map((col) => csvEscape(row[col])).join(","),
  );
  return `\uFEFF${[header, ...lines].join("\n")}\n`;
}
