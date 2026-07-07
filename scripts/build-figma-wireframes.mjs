#!/usr/bin/env bun
/**
 * High-fidelity wireframes — matches actual app mockup
 * Flow annotations appear BELOW the phone frame (not overlaid on content)
 * Tap-ring marks the tapped button with a clean step badge
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const CHANNEL = process.env.FIGMA_CHANNEL ?? "28aj3wcs";
const WS_URL  = "ws://localhost:3055";
const TO_MS   = 180_000;
const SRC_MAP = "5:1601";

/* ── Sizing ──────────────────────────────────────────────────── */
const W   = 390;   // phone width
const H   = 844;   // phone height
const ANN = 88;    // annotation strip below phone
const FH  = H + ANN; // total frame height

/* ── Metro map scale ─────────────────────────────────────────── */
const VB        = { w: 1150.36, h: 1074.59 };
const MAP_INSET = { x: 8, y: 8, w: 342, h: 280 };
const SCALE     = Math.min(MAP_INSET.w / VB.w, MAP_INSET.h / VB.h);

/* ── Exact Tailwind colours from the app ─────────────────────── */
const T = {
  white:   "#ffffff",
  s950:    "#020617",   // slate-950
  s900:    "#0f172a",   // slate-900  ← primary button, h1 on macro
  s800:    "#1e293b",   // slate-800  ← main body text
  s700:    "#334155",   // slate-700
  s600:    "#475569",   // slate-600  ← secondary text
  s500:    "#64748b",   // slate-500  ← label text
  s400:    "#94a3b8",   // slate-400  ← muted / inactive
  s300:    "#cbd5e1",   // slate-300
  s200:    "#e2e8f0",   // slate-200  ← border
  s100:    "#f1f5f9",   // slate-100  ← time-chip bg
  s50:     "#f8fafc",   // slate-50   ← input / card bg
  amber50: "#fffbeb",
  amber800:"#92400e",
  rose700: "#be123c",
  rose800: "#9f1239",
  rose600: "#e11d48",
  rose50:  "#fff1f2",
  green50: "#f0fdf4",
  green600:"#16a34a",
  green800:"#166534",
  emerald7:"#047857",
  line2:   "#00a44a",
  // Crowding
  RELAXED:  "#3cb878",
  NORMAL:   "#5b9bd5",
  BUSY:     "#8b6cc1",
  VERY_BUSY:"#e06090",
};

/* ── Grid: assigned at runtime from STATES order (6 columns) ─── */
const COLS = 6;
const COL_GAP = 120;
const ROW_GAP = 180;
const GRID = {};

/* ── All UX states in user-journey order ─────────────────────── */
const STATES = [
  // ── 홈 ──────────────────────────────────────────────────────
  { key:"01 홈",           event:"APP_ENTRY",         desc:"앱 진입 — 홈 기본 상태 (#home)" },
  { key:"02 시간시트",     event:"HOME_TIME_OPEN",    desc:"출발 시간 버튼 탭 → 바텀시트 슬라이드업" },
  { key:"03 홈(시간적용)", event:"SHEET_CONFIRM",     desc:"적용 탭 → 출발 시간 반영 후 홈 복귀" },
  // ── 경로 검색 결과 ──────────────────────────────────────────
  { key:"04 경로",         event:"HOME_SEARCH",       desc:"경로 예측 검색 / 즐겨찾기 카드 → #results" },
  { key:"05 경로(19시)",   event:"RESULTS_SLIDER",    desc:"출발 시간 슬라이더 → 19:00 차트 갱신" },
  { key:"06 경로(방향)",   event:"RESULTS_DIRECTION", desc:"↔ 반대 방향 탭 → 차트 방향 전환" },
  { key:"07 상세",         event:"RESULTS_ROUTE",     desc:"경로 카드 탭 → #detail (다이어그램·히트맵)" },
  { key:"08 경로(복귀)",   event:"DETAIL_BACK",       desc:"← 뒤로 탭 → 경로 결과 복귀" },
  // ── 노선도 (MacroView) ──────────────────────────────────────
  { key:"09 노선도",       event:"NAV_MACRO",         desc:"하단 노선도 탭 → #macro" },
  { key:"10 출발선택",     event:"MACRO_STATION_DEP", desc:"지도에서 출발역(신도림) 탭 → 출발 지정" },
  { key:"11 도착완료",     event:"MACRO_STATION_ARR", desc:"도착역(강남) 탭 → 자동으로 도착 모드" },
  { key:"12 출발모드",     event:"MACRO_ROLE_DEP",    desc:"출발 pill 버튼 탭 → 선택 모드 전환" },
  { key:"13 시간(19시)",   event:"MACRO_TIME_CHIP",   desc:"19:00 시간 칩 탭 → 노선도 혼잡도 반영" },
  { key:"14 2호선필터",    event:"MACRO_FILTER_LINE", desc:"2호선 범례 탭 → 해당 노선 강조" },
  { key:"15 전체범례",     event:"MACRO_FILTER_ALL",  desc:"전체 범례 탭 → 필터 해제" },
  { key:"16 경로(노선도)", event:"MACRO_SEARCH",      desc:"출·도착 완료 후 검색 → #results" },
];

/* ── All click / event flows (UX 순서) ───────────────────────── */
const FLOWS = [
  // 홈 플로우
  { step: 1,  from:"01 홈",           event:"HOME_TIME_OPEN",    to:"02 시간시트",     label:"① 출발 시간 버튼 탭",           zone:{ x:32, y:390, w:326, h:44 } },
  { step: 2,  from:"02 시간시트",     event:"SHEET_CONFIRM",     to:"03 홈(시간적용)", label:"② 적용 탭",                     zone:{ x:205, y:738, w:165, h:44 } },
  { step: 3,  from:"02 시간시트",     event:"SHEET_CANCEL",      to:"01 홈",           label:"③ 취소 탭 → 홈",                zone:{ x:24,  y:738, w:160, h:44 } },
  { step: 4,  from:"01 홈",           event:"HOME_SEARCH",       to:"04 경로",         label:"④ 경로 예측 검색 탭",           zone:{ x:32, y:446, w:326, h:48 } },
  { step: 5,  from:"01 홈",           event:"HOME_FAVORITE",     to:"04 경로",         label:"⑤ 즐겨찾기 카드 탭",            zone:{ x:16, y:540, w:358, h:80 } },
  { step: 6,  from:"01 홈",           event:"NAV_DETAIL_OFF",    to:"01 홈",           label:"⑥ 상세 탭 (비활성)",            zone:{ x:195, y:788, w:97, h:56 } },
  { step: 7,  from:"03 홈(시간적용)", event:"HOME_SEARCH",       to:"04 경로",         label:"⑦ 검색 (시간 변경 후)",         zone:{ x:32, y:446, w:326, h:48 } },
  // 경로 결과 플로우
  { step: 8,  from:"04 경로",         event:"RESULTS_BACK",      to:"01 홈",           label:"⑧ ← 뒤로 → 홈",                 zone:{ x:16, y:24, w:40, h:40 } },
  { step: 9,  from:"04 경로",         event:"RESULTS_SLIDER",    to:"05 경로(19시)",   label:"⑨ 시간 슬라이더 드래그",        zone:{ x:16, y:136, w:358, h:44 } },
  { step:10,  from:"05 경로(19시)",   event:"RESULTS_DIRECTION", to:"06 경로(방향)",   label:"⑩ ↔ 반대 방향 탭",              zone:{ x:284, y:148, w:76, h:22 } },
  { step:11,  from:"05 경로(19시)",   event:"RESULTS_ROUTE_FAST",to:"07 상세",         label:"⑪ 최단 시간 카드 탭",            zone:{ x:16, y:380, w:358, h:100 } },
  { step:12,  from:"05 경로(19시)",   event:"RESULTS_ROUTE_COMFORT",to:"07 상세",      label:"⑫ 쾌적 우선 카드 탭",            zone:{ x:16, y:492, w:358, h:104 } },
  { step:13,  from:"07 상세",         event:"DETAIL_BACK",       to:"08 경로(복귀)",   label:"⑬ ← 뒤로 → 결과",               zone:{ x:16, y:24, w:40, h:40 } },
  { step:14,  from:"04 경로",         event:"NAV_MACRO",         to:"09 노선도",       label:"⑭ 하단 노선도 탭",              zone:{ x:293, y:788, w:97, h:56 } },
  // 노선도 플로우
  { step:15,  from:"01 홈",           event:"NAV_MACRO",         to:"09 노선도",       label:"⑮ 하단 노선도 탭",              zone:{ x:293, y:788, w:97, h:56 } },
  { step:16,  from:"09 노선도",       event:"MACRO_STATION_DEP", to:"10 출발선택",   label:"⑯ 신도림역 탭",                 zone:null, stationName:"신도림" },
  { step:17,  from:"10 출발선택",     event:"MACRO_STATION_ARR", to:"11 도착완료",   label:"⑰ 강남역 탭",                   zone:null, stationName:"강남" },
  { step:18,  from:"11 도착완료",     event:"MACRO_ROLE_DEP",    to:"12 출발모드",   label:"⑱ 출발 pill 탭",                zone:{ x:8, y:60, w:183, h:52 } },
  { step:19,  from:"11 도착완료",     event:"MACRO_TIME_CHIP",   to:"13 시간(19시)", label:"⑲ 19:00 시간 칩 탭",            zone:{ x:302, y:123, w:68, h:34 } },
  { step:20,  from:"11 도착완료",     event:"MACRO_FILTER_LINE", to:"14 2호선필터",  label:"⑳ 2호선 범례 탭",               zone:{ x:60, y:174, w:56, h:20 } },
  { step:21,  from:"14 2호선필터",    event:"MACRO_FILTER_ALL",  to:"15 전체범례",   label:"㉑ 전체 범례 탭",               zone:{ x:14, y:174, w:40, h:20 } },
  { step:22,  from:"11 도착완료",     event:"MACRO_SEARCH",      to:"16 경로(노선도)",label:"㉒ 경로 예측 검색 탭",           zone:{ x:8, y:516, w:374, h:48 }, changedSearch:true },
  { step:23,  from:"16 경로(노선도)", event:"NAV_HOME",          to:"01 홈",           label:"㉓ 하단 홈 탭",                 zone:{ x:0, y:788, w:97, h:56 } },
  { step:24,  from:"08 경로(복귀)",   event:"NAV_RESULTS",       to:"04 경로",         label:"㉔ 하단 경로 탭",               zone:{ x:97, y:788, w:97, h:56 } },
  { step:25,  from:"07 상세",         event:"NAV_DETAIL",        to:"07 상세",         label:"㉕ 하단 상세 탭 (활성)",        zone:{ x:195, y:788, w:97, h:56 } },
];

/* ── Util ────────────────────────────────────────────────────── */
function hex(h, a = 1) {
  const s = h.replace("#","");
  return { r:parseInt(s.slice(0,2),16)/255, g:parseInt(s.slice(2,4),16)/255, b:parseInt(s.slice(4,6),16)/255, a };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function stationAbsPos(st) {
  const MAP_Y = 208;
  const px = 8 + MAP_INSET.x + st.x * SCALE;
  const py = MAP_Y + MAP_INSET.y + st.y * SCALE;
  return { x: px - 14, y: py - 14, w: 28, h: 28 };
}

/* ── Figma client ────────────────────────────────────────────── */
class FigmaClient {
  constructor() { this.ws=null; this.pending=new Map(); this.nodes={}; this.failures=[]; }

  connect() {
    return new Promise((res,rej) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.addEventListener("open", res);
      this.ws.addEventListener("error", rej);
      this.ws.addEventListener("message", ev => {
        let d; try { d=JSON.parse(ev.data); } catch { return; }
        const id = d?.message?.id ?? d?.id;
        if (id && this.pending.has(id)) {
          const p = this.pending.get(id);
          clearTimeout(p.timer); this.pending.delete(id);
          if (d.message?.error) p.reject(new Error(d.message.error));
          else p.resolve(d.message?.result ?? d.message);
        }
      });
    });
  }

  join() {
    return new Promise((res,rej) => {
      const id = randomUUID();
      const t = setTimeout(() => rej(new Error("join timeout")), 10_000);
      const h = ev => {
        const d = JSON.parse(ev.data);
        if (d.type==="system" && d.message?.result?.includes?.("Connected")) {
          clearTimeout(t); this.ws.removeEventListener("message",h); res();
        }
      };
      this.ws.addEventListener("message", h);
      this.ws.send(JSON.stringify({ id, type:"join", channel:CHANNEL }));
    });
  }

  send(cmd, params={}) {
    return new Promise((res,rej) => {
      const id = randomUUID();
      const timer = setTimeout(() => { this.pending.delete(id); rej(new Error(`Timeout: ${cmd}`)); }, TO_MS);
      this.pending.set(id, { resolve:res, reject:rej, timer });
      this.ws.send(JSON.stringify({ id, type:"message", channel:CHANNEL, message:{ id, command:cmd, params:{ ...params, commandId:id } } }));
    });
  }

  async cmd(c, p) {
    try { return await this.send(c, p); }
    catch(e) { this.failures.push({c,e:e.message}); console.warn(`  ⚠ ${c}: ${e.message}`); return null; }
  }

  async setFill(id, color, a=1) { if(id) await this.cmd("set_fill_color",{ nodeId:id, color:hex(color,a) }); }
  async setStroke(id, color, w=1) { if(id) await this.cmd("set_stroke_color",{ nodeId:id, color:hex(color), weight:w }); }

  async frame(pid, name, x, y, w, h, opts={}) {
    const r = await this.cmd("create_frame",{ parentId:pid, name, x, y, width:w, height:h, fillColor:hex(opts.fill ?? T.white) });
    if(r?.id) {
      if(opts.radius) await this.cmd("set_corner_radius",{ nodeId:r.id, radius:opts.radius });
      if(opts.stroke) await this.setStroke(r.id, opts.stroke, opts.sw ?? 1);
    }
    return r;
  }

  async rect(pid, name, x, y, w, h, opts={}) {
    const r = await this.cmd("create_rectangle",{ parentId:pid, name, x, y, width:w, height:h });
    if(r?.id) {
      await this.setFill(r.id, opts.fill ?? T.white, opts.alpha ?? 1);
      if(opts.radius) await this.cmd("set_corner_radius",{ nodeId:r.id, radius:opts.radius });
      if(opts.stroke) await this.setStroke(r.id, opts.stroke, opts.sw ?? 1);
    }
    return r;
  }

  async text(pid, name, x, y, content, opts={}) {
    return this.cmd("create_text",{ parentId:pid, name, x, y, text:content,
      fontSize: opts.size ?? 14,
      fontWeight: opts.weight ?? 400,
      fontColor: hex(opts.color ?? T.s800),
    });
  }

  // Card: white bg, rounded-xl (12), border slate-200 1px
  async card(pid, name, x, y, w, h, opts={}) {
    return this.frame(pid, name, x, y, w, h, { fill: opts.fill ?? T.white, radius: opts.radius ?? 12, stroke: opts.stroke ?? T.s200, sw: opts.sw ?? 1 });
  }

  // Input field: bg-slate-50, rounded-xl
  async input(pid, name, x, y, w, value, placeholder=false) {
    const f = await this.rect(pid, name, x, y, w, 44, { fill: T.s50, radius: 12, stroke: T.s200, sw: 1 });
    if(f?.id) await this.text(pid, `${name}_v`, x+16, y+14, value, { size:14, color: placeholder ? T.s400 : T.s800 });
    return f;
  }
}

/* ── Tap-ring (clean 2px red border + step badge) ─────────────── */
async function tapRing(client, pid, zone, step, label) {
  const { x, y, w, h } = zone;
  // Red border ring (no fill)
  await client.rect(pid, `_ring${step}`, x-3, y-3, w+6, h+6, { fill: T.white, alpha:0.01, stroke:"#ef4444", sw:2.5, radius:14 });
  // Step badge: red pill top-right of element
  const bx = x + w - 4;
  const by = y - 18;
  await client.rect(pid, `_badgebg${step}`, bx-18, by, 30, 18, { fill:"#ef4444", radius:9 });
  await client.text(pid, `_badge${step}`, bx-14, by+3, `${step}`, { size:9, weight:700, color:"#ffffff" });
}

/* ── Changed element highlight (yellow, subtle) ──────────────── */
async function changedHL(client, pid, x, y, w, h) {
  await client.rect(pid, "_changed", x-2, y-2, w+4, h+4, { fill:"#fef9c3", alpha:0.6, stroke:"#fbbf24", sw:1.5, radius:14 });
}

/* ── Small icon placeholder (14×14 square, rounded) ─────────── */
async function icon(client, pid, x, y, fill=T.s400) {
  await client.rect(pid, "_icon", x, y, 16, 16, { fill, radius:4 });
}

/* ── Bottom nav — matches App.jsx nav ────────────────────────── */
async function bottomNav(client, pid, active, opts = {}) {
  const { detailDisabled = false } = opts;
  await client.rect(pid, "nav-bg", 0, H-56, W, 56, { fill: T.white, stroke: T.s200, sw:1 });
  const tabs = [
    { id:"home",    label:"홈",    x:0 },
    { id:"results", label:"경로",  x:1 },
    { id:"detail",  label:"상세",  x:2 },
    { id:"macro",   label:"노선도",x:3 },
  ];
  for (const t of tabs) {
    const cx = Math.round(W/8 + t.x * W/4);
    const on = t.id === active;
    const disabled = t.id === "detail" && detailDisabled;
    const iconFill = disabled ? T.s300 : on ? T.s900 : T.s300;
    const textColor = disabled ? T.s300 : on ? T.s800 : T.s400;
    const textWeight = on && !disabled ? 600 : 400;
    await client.rect(pid, `nav-ic-${t.id}`, cx-10, H-56+8, 20, 20, {
      fill: iconFill, radius:5, alpha: disabled ? 0.35 : 1,
    });
    await client.text(pid, `nav-lbl-${t.id}`, cx-14, H-56+30, t.label, {
      size:10, weight: textWeight, color: textColor,
    });
  }
}

/* ── HOME SCREEN ─────────────────────────────────────────────── */
async function buildHome(client, pid, opts={}) {
  const { sheet=false, timeApplied=false, detailDisabled=false } = opts;
  const cx = 16, cw = 358;  // px-4

  // pt-6=24: Header  (flex items-center justify-between)
  await icon(client, pid, 16, 32, T.s400);         // Settings gear
  await icon(client, pid, 36, 32, T.s600);         // Train icon  
  await client.text(pid, "hd-title", 58, 30, "SUBWAY PREDICT", { size:17, weight:700, color:T.s800 });
  await icon(client, pid, 358, 32, T.s400);         // User icon

  // Alert card: bg-amber-50 (y=88, h=96)
  const alertCard = await client.rect(pid, "alert-card", cx, 88, cw, 96, { fill:T.amber50, radius:12, stroke:T.s200 });
  if(alertCard?.id) {/* no-op, text below */}
  await icon(client, pid, cx+16, 100, T.amber800);
  await client.text(pid, "alert-title", cx+36, 100, "오늘의 정체 예보", { size:13, weight:600, color:T.amber800 });
  await client.text(pid, "alert-b1", cx+16, 120, "🌧️ 18:00 퇴근길 비 예보 + 🎤 잠실 콘서트(2만명)", { size:12, color:T.s700 });
  await client.text(pid, "alert-b2", cx+16, 140, "→ 2호선 사당–잠실 18~20시 혼잡도 140% 폭증 예상", { size:12, color:T.rose700 });

  // Section title (어디로, y=204)
  await client.text(pid, "sec-title", cx, 206, "어디로 이동하시나요?", { size:13, weight:500, color:T.s600 });

  // Search card (y=230, h=268, space-y-3 inside, p-4=16)
  const sc = await client.card(pid, "search-card", cx, 230, cw, 268);

  // dep label (y+16=246)
  await icon(client, pid, cx+16+4, 248, T.s500);
  await client.text(pid, "dep-lbl", cx+16+24, 248, "출발", { size:11, color:T.s500 });
  // dep input (y=264)
  await client.rect(pid, "dep-in", cx+16, 264, 326, 44, { fill:T.s50, radius:12, stroke:T.s200 });
  await client.text(pid, "dep-val", cx+16+16, 278, "신도림역", { size:14, color:T.s800 });

  // arr label (y=320, 264+44+12=320)
  await client.text(pid, "arr-lbl", cx+16, 320, "도착", { size:11, color:T.s500 });
  // arr input (y=334)
  await client.rect(pid, "arr-in", cx+16, 334, 326, 44, { fill:T.s50, radius:12, stroke:T.s200 });
  await client.text(pid, "arr-val", cx+16+16, 348, "강남역", { size:14, color:T.s800 });

  // time picker button (y=390, h=44) — flex justify-between
  await client.rect(pid, "time-btn", cx+16, 390, 326, 44, { fill:T.s50, radius:12, stroke:T.s200 });
  await client.text(pid, "time-lbl", cx+16+16, 404, "출발 시간", { size:13, color:T.s500 });
  await client.text(pid, "time-val", cx+16+196, 404, timeApplied ? "7월 6일 (월) 19:00  ˅" : "7월 6일 (월) 18:30  ˅", { size:13, weight:500, color:T.s800 });
  if(timeApplied) await changedHL(client, pid, cx+16, 390, 326, 44);

  // search button (y=446, h=48, size=lg)
  await client.rect(pid, "search-btn", cx+16, 446, 326, 48, { fill:T.s900, radius:12 });
  await client.text(pid, "search-txt", cx+16+91, 462, "경로 예측 검색", { size:15, weight:600, color:T.white });

  // Fav section title (y=514)
  await client.text(pid, "fav-ttl", cx, 516, "★  자주 가는 쾌적 경로", { size:13, weight:500, color:T.s600 });

  // Fav card (y=540, h=80)
  const fav = await client.card(pid, "fav-card", cx, 540, cw, 80);
  await client.text(pid, "fav-main", cx+16, 554, "🏠 집  ➔  🏢 회사 (2호선 오피스 라인)", { size:14, weight:500, color:T.s800 });
  await client.text(pid, "fav-sub",  cx+16, 574, "소요시간 32분  |  현재: 🟢 여유", { size:12, color:T.s500 });
  // Badge: "30분 뒤 🟡 주의 예상"
  await client.rect(pid, "fav-badge", cx+16, 590, 124, 20, { fill:"#fef9c3", radius:10, stroke:"#fbbf24", sw:1 });
  await client.text(pid, "fav-badge-t", cx+20, 594, "30분 뒤 🟡 주의 예상", { size:9, color:"#92400e" });

  await bottomNav(client, pid, "home", { detailDisabled });

  // Time bottom sheet overlay
  if(sheet) {
    // Dim overlay
    await client.rect(pid, "dim", 0, 0, W, H, { fill:"#000000", alpha:0.22 });
    // Sheet: rounded-t-2xl, p-6, pb-8
    // Height ≈ drag(4)+mb-4(16)+title(28)+mb-6(24)+4rows×(48+12)-12+mt-4(16)+text(20)+mt-6(24)+btn(44)+p-bottom(32) ≈ 460
    const shY = H - 464;
    const sh = await client.rect(pid, "sheet-bg", 0, shY, W, 464, { fill:T.white, radius:20, stroke:T.s200 });
    // Drag handle (mx-auto h-1 w-10 bg-slate-200)
    await client.rect(pid, "drag", W/2-20, shY+12, 40, 4, { fill:T.s200, radius:2 });
    // Title: Calendar icon + "출발 시간 설정"
    await icon(client, pid, 24, shY+36, T.s600);
    await client.text(pid, "sh-title", 48, shY+36, "출발 시간 설정", { size:16, weight:600, color:T.s800 });
    // 4 rows: 월/일/시/분 (each h=48, bg-slate-50 rounded-xl, Minus | value | Plus)
    const rowLabels = ["월","일","시","분"];
    const rowValues = ["7월","6일","18시","30분"];
    for(let i=0; i<4; i++) {
      const ry = shY + 76 + i*60;
      await client.rect(pid, `row${i}`, 24, ry, 342, 48, { fill:T.s50, radius:12 });
      await client.text(pid, `rowlbl${i}`, 40, ry+16, rowLabels[i], { size:13, color:T.s500 });
      // Minus button (left icon)
      await client.rect(pid, `rowm${i}`, 240, ry+12, 32, 24, { fill:T.s100, radius:6 });
      await client.text(pid, `rowmt${i}`, 251, ry+17, "−", { size:13, color:T.s600 });
      // Value (center)
      await client.text(pid, `rowval${i}`, 278, ry+16, rowValues[i], { size:14, weight:600, color:T.s800 });
      // Plus button
      await client.rect(pid, `rowp${i}`, 318, ry+12, 32, 24, { fill:T.s100, radius:6 });
      await client.text(pid, `rowpt${i}`, 329, ry+17, "+", { size:13, color:T.s600 });
    }
    // Footer text
    await client.text(pid, "sh-foot", W/2-80, shY+330, "7월 6일 (월) 18:30 (퇴근 시간)", { size:13, color:T.s500 });
    // Buttons row: 취소 | 적용
    await client.rect(pid, "sh-cancel", 24, shY+358, 160, 48, { fill:T.s100, radius:12, stroke:T.s200 });
    await client.text(pid, "sh-cancel-t", 84, shY+374, "취소", { size:14, color:T.s600 });
    await client.rect(pid, "sh-confirm", 206, shY+358, 160, 48, { fill:T.s900, radius:12 });
    await client.text(pid, "sh-confirm-t", 260, shY+374, "적용", { size:14, weight:600, color:T.white });
  }
}

/* ── ROUTE RESULTS SCREEN ────────────────────────────────────── */
async function buildResults(client, pid, opts={}) {
  const { mark="18:30", showChangedSlider=false, showChangedRoute2=false, showChangedRoute1=false, directionSwap=false } = opts;
  const cx=16, cw=358;

  // Header: ← + "경로 검색 결과" / "신도림역 → 강남역"
  await icon(client, pid, cx, 30, T.s600);   // ArrowLeft
  await client.text(pid, "h-sub",  cx+28, 28, "경로 검색 결과", { size:11, color:T.s500 });
  await client.text(pid, "h-main", cx+28, 44, "신도림역  →  강남역", { size:15, weight:600, color:T.s800 });

  // Chart card (y=76, h=272)
  const chartY = 76;
  await client.card(pid, "chart-card", cx, chartY, cw, 272);

  // Hint text
  await client.text(pid, "hint", cx+16, chartY+16, "출발 시각을 조절하면 아래 차트가 갱신됩니다", { size:11, color:T.s500 });

  // Slider marks (["17:30","18:00","18:30","19:00","19:30"])
  const marks = ["17:30","18:00","18:30","19:00","19:30"];
  for(let i=0; i<5; i++) {
    const on = marks[i]===mark;
    await client.text(pid, `mk${i}`, cx+16+i*66, chartY+36, marks[i], { size:10, weight: on?700:400, color: on?T.s800:T.s400 });
  }

  // Slider track + thumb
  await client.rect(pid, "sldr-trk", cx+16, chartY+56, 326, 4, { fill:T.s200, radius:2 });
  const thumbXMap = { "17:30":16,"18:00":97,"18:30":179,"19:00":261,"19:30":342 };
  const tx = thumbXMap[mark] ?? 179;
  await client.rect(pid, "sldr-thb", cx+16+tx-7, chartY+50, 14, 14, { fill:T.line2, radius:7 });
  if(showChangedSlider) await changedHL(client, pid, cx+12, chartY+32, 332, 44);

  // Chart direction label
  const dirLabel = directionSwap ? "신도림 방면" : "강남 방면";
  await client.text(pid, "dir-lbl", cx+16, chartY+76, `사당  ·  2호선  ·  ${dirLabel}  (${mark})`, { size:12, weight:600, color:T.s700 });
  await client.rect(pid, "dir-swap", cx+268, chartY+72, 76, 22, { fill: directionSwap ? T.green50 : T.s50, radius:8, stroke: directionSwap ? T.green600 : T.s200 });
  await client.text(pid, "dir-swap-t", cx+278, chartY+77, "↔ 반대 방향", { size:9, color: directionSwap ? T.green800 : T.s500 });
  if(directionSwap) await changedHL(client, pid, cx+266, chartY+70, 80, 26);

  // Bar chart (y=chartY+100, h=140)
  const bars = mark==="19:00" ? [55,70,85,78,65,52,48,42] : [45,62,88,95,72,58,50,42];
  const bColors = mark==="19:00"
    ? [T.NORMAL,T.BUSY,T.BUSY,T.BUSY,T.NORMAL,T.NORMAL,T.RELAXED,T.RELAXED]
    : [T.RELAXED,T.NORMAL,T.BUSY,T.VERY_BUSY,T.BUSY,T.NORMAL,T.RELAXED,T.RELAXED];
  const chartInner = await client.rect(pid, "chart-inner", cx+16, chartY+104, 326, 128, { fill:T.s50, radius:8 });
  for(let i=0; i<8; i++) {
    const bh = Math.round((bars[i]/100)*108);
    await client.rect(pid, `bar${i}`, cx+16+10+i*38, chartY+104+108-bh+10, 28, bh, { fill:bColors[i], radius:3 });
  }

  // Section: 추천 경로 (y=368)
  await client.text(pid, "routes-ttl", cx, chartY+282, "추천 경로", { size:13, weight:600, color:T.s600 });

  // Route 1 card (y=chartY+304=380, h=100)
  const r1 = await client.card(pid, "rt1", cx, chartY+304, cw, 100, { stroke: showChangedRoute1 ? T.s900 : T.s200, sw: showChangedRoute1 ? 2 : 1 });
  await client.text(pid, "rt1-n", cx+16, chartY+320, "최단 시간", { size:14, weight:600, color:T.s800 });
  await client.rect(pid, "rt1-badge", cx+98, chartY+318, 56, 20, { fill:T.s100, radius:10, stroke:T.s200 });
  await client.text(pid, "rt1-badge-t", cx+108, chartY+322, "2호선 직통", { size:9, color:T.s600 });
  await icon(client, pid, cx+16, chartY+348, T.s500);
  await client.text(pid, "rt1-time", cx+36, chartY+348, "32분", { size:13, color:T.s600 });
  await icon(client, pid, cx+80, chartY+348, T.s500);
  await client.text(pid, "rt1-fare", cx+100, chartY+348, "1,250원", { size:13, color:T.s600 });
  await client.text(pid, "rt1-info", cx+16, chartY+368, "혼잡도  주의  (최대 128%)", { size:12, color:T.s500 });

  // Route 2 card (y=chartY+416=492, h=104) — recommended
  const r2stroke = showChangedRoute2 ? T.line2 : T.s200;
  const r2 = await client.card(pid, "rt2", cx, chartY+416, cw, 104, { stroke:r2stroke, sw: showChangedRoute2?2:1 });
  await client.text(pid, "rt2-n", cx+16, chartY+432, "쾌적 우선", { size:14, weight:600, color:T.s800 });
  await client.rect(pid, "rt2-badge", cx+98, chartY+430, 46, 20, { fill:T.s100, radius:10, stroke:T.s200 });
  await client.text(pid, "rt2-badge-t", cx+110, chartY+434, "9호선", { size:9, color:T.s600 });
  // 추천 badge
  await client.rect(pid, "rt2-rec", cx+cw-60, chartY+430, 44, 20, { fill:T.green50, radius:10, stroke:T.green600, sw:1 });
  await client.text(pid, "rt2-rect", cx+cw-52, chartY+434, "추천", { size:9, weight:600, color:T.green800 });
  await icon(client, pid, cx+16, chartY+460, T.s500);
  await client.text(pid, "rt2-time", cx+36, chartY+460, "39분 (+7분)", { size:13, color:T.s600 });
  await icon(client, pid, cx+108, chartY+460, T.s500);
  await client.text(pid, "rt2-fare", cx+128, chartY+460, "1,250원", { size:13, color:T.s600 });
  await client.text(pid, "rt2-info", cx+16, chartY+480, "혼잡도  여유  (최대 72%)  ·  환승 1회", { size:12, color:T.s500 });
  if(showChangedRoute1) await changedHL(client, pid, cx, chartY+304, cw, 100);
  if(showChangedRoute2) await changedHL(client, pid, cx, chartY+416, cw, 104);

  await bottomNav(client, pid, "results");
}

/* ── ROUTE DETAIL SCREEN ─────────────────────────────────────── */
async function buildDetail(client, pid) {
  const cx=16, cw=358;

  // Header
  await icon(client, pid, cx, 30, T.s600);
  await client.text(pid, "h-main", cx+28, 26, "경로 상세", { size:15, weight:600, color:T.s800 });
  await client.text(pid, "h-sub",  cx+28, 46, "신도림  →  신림  →  사당  →  강남", { size:11, color:T.s500 });

  // Route schematic card (y=72, h=160)
  const schY = 72;
  await client.card(pid, "sch-card", cx, schY, cw, 160);
  await client.text(pid, "sch-ttl", cx+16, schY+16, "경로 다이어그램", { size:12, weight:600, color:T.s500 });
  // Vertical line + station dots (3호선 orange simplified)
  const lineColor = "#f47d30";
  await client.rect(pid, "sch-line", cx+28, schY+44, 4, 100, { fill: lineColor, radius:2 });
  const stops = [
    { y: schY+48,  label:"출발", name:"원흥", big:true },
    { y: schY+78,  label:null,   name:"대곡", big:false },
    { y: schY+108, label:"도착", name:"삼송", big:true },
  ];
  for (const st of stops) {
    const r = st.big ? 10 : 7;
    await client.rect(pid, `sch-dot-${st.name}`, cx+28-r+2, st.y-r, r*2, r*2, { fill: st.big ? lineColor : T.white, radius:r, stroke: lineColor, sw:2 });
    await client.text(pid, `sch-n-${st.name}`, cx+48, st.y-6, `${st.name}역`, { size:11, weight: st.big ? 600 : 400, color: T.s800 });
    if (st.label) {
      await client.rect(pid, `sch-b-${st.name}`, cx+100, st.y-8, 32, 16, { fill: lineColor, radius:8 });
      await client.text(pid, `sch-bt-${st.name}`, cx+106, st.y-5, st.label, { size:8, weight:600, color: T.white });
    }
  }

  // Car congestion heatmap card (y=244, h=280)
  const heatY = 244;
  await client.card(pid, "heat-card", cx, heatY, cw, 280);
  await client.text(pid, "heat-ttl", cx+16, heatY+16, "칸별 혼잡도  (출발 18:30 기준)", { size:12, weight:600, color:T.s700 });

  // Heatmap grid: columns = 4 stations, rows = 6 cars
  const stNames = ["신도림","신림","사당","강남"];
  const rows = [
    [T.RELAXED,T.NORMAL,T.BUSY,T.BUSY],
    [T.RELAXED,T.BUSY,T.VERY_BUSY,T.BUSY],
    [T.NORMAL,T.BUSY,T.VERY_BUSY,T.BUSY],
    [T.NORMAL,T.NORMAL,T.BUSY,T.NORMAL],
    [T.RELAXED,T.NORMAL,T.BUSY,T.RELAXED],
    [T.RELAXED,T.RELAXED,T.NORMAL,T.RELAXED],
  ];
  // Station headers
  for(let s=0; s<4; s++) {
    await client.text(pid, `sth${s}`, cx+16+88+s*68, heatY+40, stNames[s], { size:10, weight:600, color:T.s700 });
  }
  // Car label + rows
  const carLabels = ["1호차","2호차","3호차","4호차","5호차","6호차"];
  for(let c=0; c<6; c++) {
    const ry = heatY+56+c*52;
    await client.text(pid, `car${c}`, cx+16, ry+18, carLabels[c], { size:10, color:T.s500 });
    for(let s=0; s<4; s++) {
      const cellX = cx+16+88+s*68;
      await client.rect(pid, `cell${c}${s}`, cellX, ry+8, 60, 32, { fill:rows[c][s], radius:6 });
    }
  }

  // Legend
  const legY = heatY+256;
  const crowdItems = [["여유",T.RELAXED],["보통",T.NORMAL],["혼잡",T.BUSY],["매우 혼잡",T.VERY_BUSY]];
  for(let i=0; i<4; i++) {
    await client.rect(pid, `lc${i}`, cx+16+i*84, legY, 14, 14, { fill:crowdItems[i][1], radius:3 });
    await client.text(pid, `lt${i}`, cx+34+i*84, legY+2, crowdItems[i][0], { size:9, color:T.s500 });
  }

  // Alternative tip card
  const tipY = 536;
  await client.rect(pid, "tip-card", cx, tipY, cw, 80, { fill:T.s50, radius:12, stroke:T.s200 });
  await client.text(pid, "tip-lbl", cx+16, tipY+12, "대안 안내", { size:10, weight:500, color:T.s500 });
  await client.text(pid, "tip-body", cx+16, tipY+30, "사당역에서 하차 후 4분 뒤 다음 열차를 이용하면", { size:12, color:T.s700 });
  await client.text(pid, "tip-hl",   cx+16, tipY+50, "혼잡도가 약 40% 감소합니다.", { size:12, weight:600, color:T.emerald7 });

  await bottomNav(client, pid, "detail");
}

/* ── MAP SCREEN (MacroViewScreen: px-2 pt-4) ─────────────────── */
async function buildMap(client, pid, opts={}, stations=[]) {
  const { dep="역을 선택하세요", arr="역을 선택하세요",
          depActive=false, arrActive=false, activeLine=null, showRoute=false,
          selectedTime="18:30",
          changedDep=false, changedArr=false, changedLine=false, changedSearch=false, changedTime=false, changedRole=false } = opts;

  // px-2=8, pt-4=16
  const cx=8, cw=374;
  await client.text(pid, "map-title", cx, 18, "수도권 전철 노선도", { size:17, weight:700, color:T.s900 });
  await client.text(pid, "map-sub",   cx, 40, "역을 클릭해 출발·도착을 지정하세요  ·  드래그 이동  ·  스크롤 확대/축소", { size:9, color:T.s500 });

  // Dep pill (flex-1, half width)
  const dp = await client.rect(pid, "dep-pill", cx, 60, 183, 52, {
    fill: depActive ? T.green50  : T.s50,
    radius:12,
    stroke: depActive ? T.green600 : T.s200,
    sw: depActive ? 2 : 1,
  });
  await icon(client, pid, cx+12, 74, depActive ? T.green600 : T.s500);
  await client.text(pid, "dep-role",  cx+32, 66, "출발", { size:9, weight:500, color: depActive ? T.green600 : T.s500 });
  await client.text(pid, "dep-value", cx+32, 80, dep, { size:13, weight:600, color: depActive ? T.green800 : T.s600 });
  if(changedDep || changedRole) await changedHL(client, pid, cx, 60, 183, 52);

  // Arr pill
  const ap = await client.rect(pid, "arr-pill", cx+191, 60, 183, 52, {
    fill: arrActive ? T.rose50  : T.s50,
    radius:12,
    stroke: arrActive ? T.rose600 : T.s200,
    sw: arrActive ? 2 : 1,
  });
  await icon(client, pid, cx+191+12, 74, arrActive ? T.rose600 : T.s500);
  await client.text(pid, "arr-role",  cx+191+32, 66, "도착", { size:9, weight:500, color: arrActive ? T.rose600 : T.s500 });
  await client.text(pid, "arr-value", cx+191+32, 80, arr, { size:13, weight:600, color: arrActive ? T.rose800 : T.s600 });
  if(changedArr) await changedHL(client, pid, cx+191, 60, 183, 52);

  // Time chips (y=120, h=40, bg-slate-100 rounded-xl)
  await client.rect(pid, "time-container", cx, 120, cw, 40, { fill:T.s100, radius:12 });
  const tmarks = ["17:30","18:00","18:30","19:00","19:30"];
  for(let i=0; i<5; i++) {
    const on = tmarks[i]===selectedTime;
    if(on) await client.rect(pid, `tchip${i}`, cx+4+i*74, 123, 68, 34, { fill:T.white, radius:8 });
    await client.text(pid, `ttxt${i}`, cx+10+i*74, 133, tmarks[i], { size:11, weight: on?600:400, color: on?T.s800:T.s500 });
  }
  if(changedTime) await changedHL(client, pid, cx+302, 121, 72, 38);

  // Legend row (y=168, h=32, bg-slate-100)
  const legY = 168;
  await client.rect(pid, "leg-bg", cx, legY, cw, 32, { fill:T.s100, radius:10 });
  // 전체 chip
  const allActive = activeLine===null;
  await client.rect(pid, "leg-all", cx+6, legY+6, 40, 20, { fill: allActive?T.s900:T.white, radius:10 });
  await client.text(pid, "leg-all-t", cx+14, legY+11, "전체", { size:8, weight:600, color: allActive?T.white:T.s500 });
  // 2호선
  const l2 = activeLine==="2호선";
  await client.rect(pid, "leg-l2-bg", cx+52, legY+6, 56, 20, { fill: l2?T.green50:T.white, radius:10, stroke: l2?T.green600:T.s200, sw: l2?2:1 });
  await client.rect(pid, "leg-l2-dot", cx+58, legY+11, 10, 10, { fill:T.line2, radius:2 });
  await client.text(pid, "leg-l2-t", cx+72, legY+11, "2호선", { size:8, weight: l2?700:400, color: l2?T.green800:T.s600 });
  if(changedLine) await changedHL(client, pid, cx+50, legY+4, 60, 24);

  // Map area (y=208, h=300) — clone actual metro map
  const mapY = 208;
  const mapArea = await client.rect(pid, "map-area", cx, mapY, cw, 300, { fill:"#f9fafb", radius:12, stroke:T.s200 });
  const cloned = await client.cmd("clone_node",{ nodeId:SRC_MAP, parentId:mapArea?.id ?? pid, x:MAP_INSET.x, y:MAP_INSET.y });
  if(cloned?.id) await client.cmd("resize_node",{ nodeId:cloned.id, width:VB.w*SCALE, height:VB.h*SCALE });

  // Station markers
  if(mapArea?.id) {
    const sd = stations.find(s => s.name==="신도림");
    const gn = stations.find(s => s.name==="강남");
    if(depActive && sd) {
      const px=MAP_INSET.x+sd.x*SCALE, py=MAP_INSET.y+sd.y*SCALE;
      await client.rect(mapArea.id, "dep-ring", px-10, py-10, 20, 20, { fill:T.white, alpha:0.01, stroke:T.green600, sw:2.5, radius:10 });
    }
    if(arrActive && gn) {
      const px=MAP_INSET.x+gn.x*SCALE, py=MAP_INSET.y+gn.y*SCALE;
      await client.rect(mapArea.id, "arr-ring", px-10, py-10, 20, 20, { fill:T.white, alpha:0.01, stroke:T.rose600, sw:2.5, radius:10 });
    }
  }
  // Zoom controls (top-right of map)
  await client.rect(pid, "z-plus",  cx+cw-50, mapY+8, 40, 26, { fill:T.white, radius:6, stroke:T.s200 });
  await client.text(pid, "z-plus-t", cx+cw-36, mapY+14, "+", { size:14, color:T.s600 });
  await client.rect(pid, "z-minus", cx+cw-50, mapY+38, 40, 26, { fill:T.white, radius:6, stroke:T.s200 });
  await client.text(pid, "z-minus-t",cx+cw-36, mapY+44, "−", { size:14, color:T.s600 });

  // Search button (y=516=mapY+300+8, h=48)
  const sbY = mapY+308;
  const canSearch = dep!=="역을 선택하세요" && arr!=="역을 선택하세요";
  await client.rect(pid, "map-search", cx, sbY, cw, 48, { fill: canSearch?T.s900:T.s200, radius:12 });
  await client.text(pid, "map-search-t", cx+cw/2-56, sbY+15, "경로 예측 검색", { size:15, weight:600, color: canSearch?T.white:T.s400 });
  if(changedSearch) await changedHL(client, pid, cx, sbY, cw, 48);

  // Footer
  await client.text(pid, "map-footer", cx+cw/2-80, sbY+60, `혼잡도 시뮬레이션 18:30  ·  갱신됨`, { size:9, color:T.s400 });

  await bottomNav(client, pid, "macro");
}

/* ── Annotation strip (below phone) ──────────────────────────── */
async function annotStrip(client, pid, step, event, desc) {
  // Step badge
  if(step) {
    await client.rect(pid, "ann-badge", 16, H+16, 28, 28, { fill:"#1e40af", radius:14 });
    await client.text(pid, "ann-num", 22, H+22, `${step}`, { size:11, weight:700, color:T.white });
  }
  const tx = step ? 52 : 16;
  await client.text(pid, "ann-event", tx, H+18, event,  { size:10, weight:600, color:"#1e40af" });
  await client.text(pid, "ann-desc",  tx, H+38, desc,   { size:11, color:T.s600 });
  // Separator line
  await client.rect(pid, "ann-line", 0, H, W, 1, { fill:T.s200 });
}

/* ── Build one state frame ───────────────────────────────────── */
async function buildStateFrame(client, boardId, x, y, state, stations) {
  const inFlow = FLOWS.find(f => f.to===state.key);
  const step   = inFlow?.step ?? null;

  // Outer frame: white phone with subtle border
  const f = await client.frame(boardId, state.key, x, y, W, FH, {
    fill: T.white, radius:4, stroke:T.s300, sw:1,
  });
  if(!f?.id) return null;
  client.nodes[state.key] = f.id;

  // Phone outline (inner border to simulate screen edge)
  await client.rect(f.id, "phone-outline", 0, 0, W, H, { fill:T.white, alpha:0.01, stroke:T.s200, sw:1, radius:0 });

  // Build screen content
  switch(state.key) {
    case "01 홈":
      await buildHome(client, f.id, { detailDisabled: true });
      break;
    case "02 시간시트":
      await buildHome(client, f.id, { sheet: true });
      break;
    case "03 홈(시간적용)":
      await buildHome(client, f.id, { timeApplied: true, detailDisabled: true });
      break;
    case "04 경로":
      await buildResults(client, f.id, {});
      break;
    case "05 경로(19시)":
      await buildResults(client, f.id, { mark:"19:00", showChangedSlider: true });
      break;
    case "06 경로(방향)":
      await buildResults(client, f.id, { mark:"19:00", showChangedSlider: true, directionSwap: true });
      break;
    case "07 상세":
      await buildDetail(client, f.id);
      break;
    case "08 경로(복귀)":
      await buildResults(client, f.id, { mark:"19:00", showChangedSlider: true });
      break;
    case "09 노선도":
      await buildMap(client, f.id, {}, stations);
      break;
    case "10 출발선택":
      await buildMap(client, f.id, { dep:"신도림역", depActive:true, changedDep:true }, stations);
      break;
    case "11 도착완료":
      await buildMap(client, f.id, { dep:"신도림역", arr:"강남역", depActive:true, arrActive:true, showRoute:true, changedArr:true }, stations);
      break;
    case "12 출발모드":
      await buildMap(client, f.id, { dep:"신도림역", arr:"강남역", depActive:true, arrActive:true, showRoute:true, changedRole:true }, stations);
      break;
    case "13 시간(19시)":
      await buildMap(client, f.id, { dep:"신도림역", arr:"강남역", depActive:true, arrActive:true, selectedTime:"19:00", changedTime:true }, stations);
      break;
    case "14 2호선필터":
      await buildMap(client, f.id, { dep:"신도림역", arr:"강남역", depActive:true, arrActive:true, activeLine:"2호선", changedLine:true }, stations);
      break;
    case "15 전체범례":
      await buildMap(client, f.id, { dep:"신도림역", arr:"강남역", depActive:true, arrActive:true, activeLine:null }, stations);
      break;
    case "16 경로(노선도)":
      await buildResults(client, f.id, { mark:"19:00" });
      break;
  }

  // Tap-ring annotations for outgoing flows
  const outFlows = FLOWS.filter(fl => fl.from===state.key);
  for(const fl of outFlows) {
    let zone = fl.zone;
    if(!zone && fl.stationName) {
      const st = stations.find(s => s.name===fl.stationName);
      if(st) zone = stationAbsPos(st);
    }
    if(zone) await tapRing(client, f.id, zone, fl.step, fl.label);
    // Highlight search button on map when flow has changedSearch
    if(fl.changedSearch && state.key==="11 도착완료") {
      await changedHL(client, f.id, 8, 516, 374, 48);
    }
  }

  // Annotation strip below phone
  await annotStrip(client, f.id, step, state.event, state.desc);

  return f;
}

/* ── Flow legend (right side) ────────────────────────────────── */
async function buildLegend(client, boardId, x, y) {
  const rows = Math.ceil(STATES.length / COLS);
  const lh = rows * (FH + ROW_GAP) + 48;
  const leg = await client.rect(boardId, "LEGEND-bg", x, y, 480, lh, { fill:"#f0f9ff", radius:12 });

  await client.text(boardId, "leg-t", x+20, y+24, "WIREFLOW v5 — 전체 UX 이벤트 플로우", { size:16, weight:700, color:T.s900 });
  await client.text(boardId, "leg-sub", x+20, y+48, `${STATES.length}개 화면 · ${FLOWS.length}개 클릭/이벤트`, { size:11, color:T.s500 });
  await client.rect(boardId, "leg-r1", x+20, y+52, 14, 14, { fill:"#ef4444", radius:7 });
  await client.text(boardId, "leg-r1t", x+40, y+54, "빨간 링 = 사용자가 탭한 버튼", { size:11, color:"#ef4444" });
  await client.rect(boardId, "leg-r2", x+20, y+74, 14, 14, { fill:"#fbbf24", radius:3 });
  await client.text(boardId, "leg-r2t", x+40, y+76, "노란 하이라이트 = 이 상태에서 바뀐 요소", { size:11, color:"#b45309" });
  await client.text(boardId, "leg-r3t", x+40, y+96, "숫자 배지 = STEP 번호 (화살표와 동일)", { size:11, color:T.s600 });

  let ry = y+80;
  for(const fl of FLOWS) {
    await client.rect(boardId, `fl-b${fl.step}`, x+20, ry, 24, 24, { fill:"#1e40af", radius:12 });
    await client.text(boardId, `fl-n${fl.step}`, x+28, ry+6, `${fl.step}`, { size:9, weight:700, color:T.white });
    await client.text(boardId, `fl-t${fl.step}`, x+52, ry+5, `${fl.from}  →  ${fl.to}`, { size:11, weight:600, color:T.s800 });
    await client.text(boardId, `fl-e${fl.step}`, x+52, ry+20, fl.label, { size:10, color:T.s500 });
    ry += 44;
  }
}

/* ── Main ────────────────────────────────────────────────────── */
async function main() {
  const stations = JSON.parse(readFileSync(join(ROOT,"src/lib/generated/metro-stations.json"),"utf8"));

  const client = new FigmaClient();
  console.log(`🔌 Channel: ${CHANNEL}`);
  await client.connect();
  await client.join();

  const probe = await client.cmd("get_document_info",{});
  if(!probe) throw new Error(`Figma plugin not responding on channel ${CHANNEL}`);

  for(const ch of probe.children ?? []) {
    if(ch.name?.startsWith("WIREFLOW")) {
      console.log(`  🗑 Deleting: ${ch.name} (${ch.id})`);
      await client.cmd("delete_node",{ nodeId:ch.id });
      await sleep(300);
    }
  }

  // Assign grid positions in UX order (left→right, top→bottom)
  STATES.forEach((s, i) => {
    GRID[s.key] = { col: i % COLS, row: Math.floor(i / COLS) };
  });

  const maxCol = COLS - 1;
  const maxRow = Math.ceil(STATES.length / COLS) - 1;
  const boardW = 48 + (maxCol + 1) * (W + COL_GAP) + 500;
  const boardH = 48 + (maxRow + 1) * (FH + ROW_GAP);
  const board = await client.frame(probe.id ?? "0:1",
    "WIREFLOW v5 — Full UX Event Flow", 1200, 2200, boardW, boardH, { fill:"#f0f4f8" });
  if(!board?.id) throw new Error("Board creation failed");

  function cellXY(col, row) {
    return { x: 24 + col*(W+COL_GAP), y: 24 + row*(FH+ROW_GAP) };
  }

  console.log("\n📱 Building screens…");
  for(const state of STATES) {
    const g = GRID[state.key];
    const { x, y } = cellXY(g.col, g.row);
    console.log(`  ${state.key}  (${g.col},${g.row})`);
    await buildStateFrame(client, board.id, x, y, state, stations);
    await sleep(400);
  }

  const legX = 24 + (maxCol + 1) * (W + COL_GAP) + 16;
  await buildLegend(client, board.id, legX, 24);

  const connections = FLOWS.map(fl => ({
    startNodeId: client.nodes[fl.from],
    endNodeId:   client.nodes[fl.to],
    text:        fl.label,
  })).filter(c => c.startNodeId && c.endNodeId);

  if(connections.length) {
    console.log(`\n↗ ${connections.length} flow arrows…`);
    await client.cmd("create_connections",{ connections });
  }

  console.log(`\n✅  boardId: ${board.id}`);
  console.log(JSON.stringify({ states:STATES.length, connections:connections.length, failures:client.failures.length }, null, 2));
  client.ws.close();
}

main().catch(e => { console.error("Fatal:", e.message ?? e); process.exit(1); });
