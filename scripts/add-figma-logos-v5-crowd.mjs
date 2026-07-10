#!/usr/bin/env bun
/**
 * Logo concepts v5 — 혼잡도 4색 팔레트 활용.
 * RELAXED #3cb878 · NORMAL #5b9bd5 · BUSY #8b6cc1 · VERY_BUSY #e06090
 *
 * Usage: FIGMA_CHANNEL=pv1tgjcu bun scripts/add-figma-logos-v5-crowd.mjs
 */
import { randomUUID } from "node:crypto";

const CHANNEL = process.env.FIGMA_CHANNEL ?? process.argv[2] ?? "pv1tgjcu";
const WS_URL = "ws://localhost:3055";
const TO_MS = 90_000;
const PROBE_MS = 15_000;

const ORIGIN = { x: 100, y: 19400 };
const COL_W = 360;

const C = {
  fg: "#1e293b",
  white: "#ffffff",
  muted: "#e2e8f0",
  mutedFg: "#64748b",
  relaxed: "#3cb878",
  normal: "#5b9bd5",
  busy: "#8b6cc1",
  veryBusy: "#e06090",
};

function hex(h, a = 1) {
  const s = h.replace("#", "");
  return {
    r: parseInt(s.slice(0, 2), 16) / 255,
    g: parseInt(s.slice(2, 4), 16) / 255,
    b: parseInt(s.slice(4, 6), 16) / 255,
    a,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class FigmaClient {
  constructor() {
    this.ws = null;
    this.pending = new Map();
    this.failures = [];
  }

  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.addEventListener("open", res);
      this.ws.addEventListener("error", rej);
      this.ws.addEventListener("message", (ev) => {
        let d;
        try {
          d = JSON.parse(ev.data);
        } catch {
          return;
        }
        const id = d?.message?.id ?? d?.id;
        if (id && this.pending.has(id)) {
          const p = this.pending.get(id);
          clearTimeout(p.timer);
          this.pending.delete(id);
          if (d.message?.error) p.reject(new Error(d.message.error));
          else p.resolve(d.message?.result ?? d.message);
        }
      });
    });
  }

  join() {
    return new Promise((res, rej) => {
      const id = randomUUID();
      const t = setTimeout(() => rej(new Error("join timeout")), 10_000);
      const h = (ev) => {
        const d = JSON.parse(ev.data);
        if (d.type === "system" && d.message?.result?.includes?.("Connected")) {
          clearTimeout(t);
          this.ws.removeEventListener("message", h);
          res();
        }
      };
      this.ws.addEventListener("message", h);
      this.ws.send(JSON.stringify({ id, type: "join", channel: CHANNEL }));
    });
  }

  send(cmd, params = {}, timeout = TO_MS) {
    return new Promise((res, rej) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rej(new Error(`Timeout: ${cmd}`));
      }, timeout);
      this.pending.set(id, { resolve: res, reject: rej, timer });
      this.ws.send(
        JSON.stringify({
          id,
          type: "message",
          channel: CHANNEL,
          message: { id, command: cmd, params: { ...params, commandId: id } },
        }),
      );
    });
  }

  async cmd(c, p, timeout) {
    try {
      return await this.send(c, p, timeout);
    } catch (e) {
      this.failures.push({ c, e: e.message });
      console.warn(`  ⚠ ${c}: ${e.message}`);
      return null;
    }
  }

  parseId(result) {
    if (!result) return null;
    if (typeof result === "string") {
      try {
        return JSON.parse(result)?.id ?? null;
      } catch {
        return null;
      }
    }
    return result.id ?? null;
  }

  async setFill(id, color, a = 1) {
    if (!id || a <= 0) return;
    const c = hex(color, a);
    await this.cmd("set_fill_color", { nodeId: id, color: { r: c.r, g: c.g, b: c.b, a: c.a } });
  }

  async frame(pid, name, x, y, w, h, opts = {}) {
    const fill = opts.fill && (opts.alpha ?? 1) > 0 ? hex(opts.fill, opts.alpha ?? 1) : undefined;
    const r = await this.cmd("create_frame", {
      parentId: pid,
      name,
      x,
      y,
      width: w,
      height: h,
      ...(fill ? { fillColor: fill } : {}),
    });
    const id = this.parseId(r);
    if (id && opts.radius) await this.cmd("set_corner_radius", { nodeId: id, radius: opts.radius });
    return id;
  }

  async rect(pid, name, x, y, w, h, opts = {}) {
    const fill = opts.fill && (opts.alpha ?? 1) > 0 ? hex(opts.fill, opts.alpha ?? 1) : undefined;
    const r = await this.cmd("create_rectangle", {
      parentId: pid,
      name,
      x,
      y,
      width: w,
      height: h,
      ...(fill ? { fillColor: fill } : {}),
    });
    const id = this.parseId(r);
    if (!id) return null;
    if (opts.fill && (opts.alpha ?? 1) > 0) await this.setFill(id, opts.fill, opts.alpha ?? 1);
    if (opts.radius) await this.cmd("set_corner_radius", { nodeId: id, radius: opts.radius });
    return id;
  }

  async text(pid, name, x, y, content, opts = {}) {
    const c = hex(opts.color ?? C.fg);
    const r = await this.cmd("create_text", {
      parentId: pid,
      name,
      x,
      y,
      text: content,
      fontSize: opts.size ?? 14,
      fontWeight: opts.weight ?? 600,
      fontColor: { r: c.r, g: c.g, b: c.b },
    });
    return this.parseId(r);
  }

  async circle(pid, name, x, y, size, opts = {}) {
    return this.rect(pid, name, x, y, size, size, { ...opts, radius: size / 2 });
  }
}

/** 미니 열차 (혼잡도 심벌 위에 올리기) */
async function miniTrain(client, p, x, y, scale = 1) {
  const w = 28 * scale;
  const h = 18 * scale;
  await client.rect(p, "tr-body", x, y, w, h, { fill: C.fg, radius: 4 * scale });
  await client.rect(p, "tr-st", x, y + h - 3 * scale, w, 3 * scale, { fill: C.white, radius: 1 });
  await client.circle(p, "tr-l", x + 5 * scale, y + 5 * scale, 6 * scale, { fill: C.white });
  await client.circle(p, "tr-r", x + w - 11 * scale, y + 5 * scale, 6 * scale, { fill: C.white });
}

/** 20 — 혼잡도 4색 스트립 (범례) + 녹색 구간에 열차 */
async function drawCrowdStrip(client, p) {
  const bands = [
    { y: 28, h: 18, fill: C.relaxed },
    { y: 48, h: 18, fill: C.normal },
    { y: 68, h: 18, fill: C.busy },
    { y: 88, h: 18, fill: C.veryBusy },
  ];
  await client.rect(p, "strip-bg", 20, 24, 80, 88, { fill: C.muted, radius: 8 });
  for (const b of bands) {
    await client.rect(p, `band-${b.y}`, 24, b.y, 72, b.h, { fill: b.fill, radius: 4 });
  }
  await miniTrain(client, p, 46, 30, 0.85);
  await client.rect(p, "pin", 22, 30, 4, 18, { fill: C.white, radius: 2 });
}

/** 21 — 4색 원, 녹색(여유)만 크고 열차 */
async function drawLevelDots(client, p) {
  const dots = [
    { x: 18, s: 22, fill: C.relaxed },
    { x: 42, s: 16, fill: C.normal },
    { x: 62, s: 16, fill: C.busy },
    { x: 82, s: 16, fill: C.veryBusy },
  ];
  for (const d of dots) {
    await client.circle(p, `dot-${d.x}`, d.x, 72 - d.s, d.s, { fill: d.fill });
  }
  await miniTrain(client, p, 22, 38, 0.75);
}

/** 22 — 바쁜 색 프레임 + 중앙 녹색 코어 열차 */
async function drawGreenCore(client, p) {
  await client.rect(p, "frame-t", 24, 24, 72, 10, { fill: C.veryBusy, radius: 4 });
  await client.rect(p, "frame-b", 24, 86, 72, 10, { fill: C.busy, radius: 4 });
  await client.rect(p, "frame-l", 24, 34, 10, 52, { fill: C.normal, radius: 4 });
  await client.rect(p, "frame-r", 86, 34, 10, 52, { fill: C.veryBusy, radius: 4 });
  await client.circle(p, "core", 38, 44, 44, { fill: C.relaxed });
  await miniTrain(client, p, 46, 54, 0.7);
}

/** 23 — 세로 4막대 차트 (앱 차트 스타일) */
async function drawCrowdBars(client, p) {
  const bars = [
    { x: 22, h: 52, fill: C.relaxed },
    { x: 42, h: 38, fill: C.normal },
    { x: 62, h: 28, fill: C.busy },
    { x: 82, h: 18, fill: C.veryBusy },
  ];
  await client.rect(p, "chart-base", 16, 92, 88, 4, { fill: C.muted, radius: 2 });
  for (const b of bars) {
    await client.rect(p, `bar-${b.x}`, b.x, 92 - b.h, 14, b.h, { fill: b.fill, radius: 4 });
  }
  await miniTrain(client, p, 18, 24, 0.65);
}

/** 24 — 4색 아크 게이지, 녹색(여유) 구간 강조 */
async function drawArcGauge(client, p) {
  const segs = [
    { x: 28, y: 30, w: 28, h: 8, fill: C.relaxed },
    { x: 56, y: 22, w: 8, h: 28, fill: C.normal },
    { x: 64, y: 50, w: 28, h: 8, fill: C.busy },
    { x: 36, y: 58, w: 8, h: 28, fill: C.veryBusy },
  ];
  for (const s of segs) {
    await client.rect(p, `seg-${s.x}`, s.x, s.y, s.w, s.h, { fill: s.fill, radius: 4 });
  }
  await client.circle(p, "gauge-center", 46, 46, 24, { fill: C.white });
  await client.circle(p, "gauge-dot", 52, 28, 12, { fill: C.relaxed });
  await client.rect(p, "needle", 57, 40, 3, 18, { fill: C.fg, radius: 1.5 });
}

/** 25 — 경로 선: 4색 중 녹색만 굵게 + 역 점 */
async function drawGreenPath(client, p) {
  await client.rect(p, "path-muted-1", 16, 58, 88, 4, { fill: C.veryBusy, alpha: 0.35, radius: 2 });
  await client.rect(p, "path-muted-2", 16, 68, 88, 4, { fill: C.busy, alpha: 0.35, radius: 2 });
  await client.rect(p, "path-muted-3", 16, 48, 88, 4, { fill: C.normal, alpha: 0.35, radius: 2 });
  await client.rect(p, "path-main", 16, 54, 88, 8, { fill: C.relaxed, radius: 4 });
  await client.circle(p, "st-a", 20, 50, 12, { fill: C.white, stroke: C.fg, strokeWeight: 2 });
  await client.circle(p, "st-b", 88, 50, 12, { fill: C.relaxed });
  await miniTrain(client, p, 48, 28, 0.8);
}

const CONCEPTS = [
  {
    id: "20",
    name: "Crowd Strip",
    theme: "혼잡도 범례 · 여유 구간",
    palette: "여유·보통·혼잡·매우혼잡 4색",
    type: "strip",
  },
  {
    id: "21",
    name: "Level Dots",
    theme: "4단계 · 여유만 강조",
    palette: "#3cb878 중심",
    type: "dots",
  },
  {
    id: "22",
    name: "Green Core",
    theme: "혼잡 속 여유 코어",
    palette: "4색 프레임 + 녹색 중심",
    type: "core",
  },
  {
    id: "23",
    name: "Crowd Bars",
    theme: "시간대 차트 · 여유 최대",
    palette: "막대 높이 = 혼잡도",
    type: "bars",
  },
  {
    id: "24",
    name: "Arc Gauge",
    theme: "게이지 · 여유 포인터",
    palette: "4색 아크 + 녹색 니들",
    type: "gauge",
  },
];

const DRAWERS = {
  strip: drawCrowdStrip,
  dots: drawLevelDots,
  core: drawGreenCore,
  bars: drawCrowdBars,
  gauge: drawArcGauge,
  path: drawGreenPath,
};

async function drawDark(client, inner, type) {
  const w = C.white;
  if (type === "strip") {
    await client.rect(inner, "d1", 12, 14, 40, 8, { fill: C.relaxed, radius: 2 });
    await client.rect(inner, "d2", 12, 24, 40, 6, { fill: C.normal, radius: 2 });
    await client.rect(inner, "d3", 12, 32, 40, 6, { fill: C.busy, radius: 2 });
    await client.rect(inner, "d4", 12, 40, 40, 6, { fill: C.veryBusy, radius: 2 });
    await client.rect(inner, "d-tr", 22, 16, 14, 8, { fill: w, radius: 2 });
  } else if (type === "dots") {
    await client.circle(inner, "d-g", 14, 28, 18, { fill: C.relaxed });
    await client.circle(inner, "d-b", 36, 32, 10, { fill: C.normal });
    await client.circle(inner, "d-p", 50, 32, 10, { fill: C.busy });
    await client.circle(inner, "d-r", 64, 32, 10, { fill: C.veryBusy });
  } else if (type === "core") {
    await client.rect(inner, "d-fr", 10, 10, 48, 48, { fill: C.busy, alpha: 0.4, radius: 4 });
    await client.circle(inner, "d-c", 22, 22, 24, { fill: C.relaxed });
    await client.rect(inner, "d-tr", 28, 28, 12, 8, { fill: w, radius: 2 });
  } else if (type === "bars") {
    await client.rect(inner, "d-b1", 14, 30, 8, 28, { fill: C.relaxed, radius: 2 });
    await client.rect(inner, "d-b2", 26, 38, 8, 20, { fill: C.normal, radius: 2 });
    await client.rect(inner, "d-b3", 38, 44, 8, 14, { fill: C.busy, radius: 2 });
    await client.rect(inner, "d-b4", 50, 50, 8, 8, { fill: C.veryBusy, radius: 2 });
  } else if (type === "gauge") {
    await client.rect(inner, "d-sg", 18, 14, 20, 5, { fill: C.relaxed, radius: 2 });
    await client.rect(inner, "d-sn", 38, 14, 5, 16, { fill: C.normal, radius: 2 });
    await client.rect(inner, "d-sb", 28, 38, 16, 5, { fill: C.busy, radius: 2 });
    await client.circle(inner, "d-dot", 32, 22, 8, { fill: C.relaxed });
  }
}

async function buildColumn(client, boardId, concept, col) {
  const x0 = 40 + col * COL_W;
  const colFrame = await client.frame(
    boardId,
    `${concept.id} ${concept.name}`,
    x0,
    80,
    COL_W,
    720,
    { fill: C.muted, alpha: 0.35, radius: 16 },
  );
  if (!colFrame) return;

  await client.text(colFrame, "title", 20, 16, `${concept.id} ${concept.name}`, { size: 16, weight: 700 });
  await client.text(colFrame, "theme", 20, 40, concept.theme, { size: 12, weight: 500, color: C.mutedFg });
  await client.text(colFrame, "palette", 20, 58, concept.palette, { size: 11, weight: 400, color: C.mutedFg });

  await client.text(colFrame, "lbl-s", 20, 88, "Symbol", { size: 10, weight: 600, color: C.mutedFg });
  const sym = await client.frame(colFrame, "Symbol", 20, 104, 120, 120, { fill: C.white, radius: 12 });
  if (sym && DRAWERS[concept.type]) await DRAWERS[concept.type](client, sym);

  await client.text(colFrame, "lbl-l", 20, 240, "Lockup", { size: 10, weight: 600, color: C.mutedFg });
  const lock = await client.frame(colFrame, "Lockup", 20, 256, 320, 64, { fill: C.white, radius: 12 });
  if (lock) {
    const mini = await client.frame(lock, "mini", 12, 8, 48, 48, { fill: C.muted, alpha: 0.5, radius: 8 });
    if (mini && DRAWERS[concept.type]) await DRAWERS[concept.type](client, mini);
    await client.text(lock, "wordmark", 72, 16, "여유로", { size: 26, weight: 700 });
  }

  await client.text(colFrame, "lbl-i", 20, 336, "App Icon 48", { size: 10, weight: 600, color: C.mutedFg });
  const icon = await client.frame(colFrame, "AppIcon", 20, 352, 48, 48, {
    fill: C.white,
    stroke: C.muted,
    strokeWeight: 1,
    radius: 10,
  });
  if (icon) {
    const inner = await client.frame(icon, "inner", 4, 4, 40, 40, { fill: C.muted, alpha: 0.25, radius: 8 });
    if (inner && DRAWERS[concept.type]) await DRAWERS[concept.type](client, inner);
  }

  await client.text(colFrame, "lbl-d", 20, 420, "Dark BG", { size: 10, weight: 600, color: C.mutedFg });
  const dark = await client.frame(colFrame, "Dark", 20, 436, 120, 120, { fill: C.fg, radius: 12 });
  if (dark) {
    const inner = await client.frame(dark, "d-inner", 20, 20, 80, 80, { fill: C.fg, radius: 8 });
    if (inner) await drawDark(client, inner, concept.type);
  }

  // 혼잡도 컬러 칩
  const chipY = 572;
  const chips = [
    { label: "여유", color: C.relaxed },
    { label: "보통", color: C.normal },
    { label: "혼잡", color: C.busy },
    { label: "매우", color: C.veryBusy },
  ];
  for (let i = 0; i < chips.length; i++) {
    const ch = chips[i];
    const cx = 20 + i * 78;
    await client.rect(colFrame, `chip-${i}`, cx, chipY, 14, 14, { fill: ch.color, radius: 3 });
    await client.text(colFrame, `chip-lbl-${i}`, cx + 18, chipY, ch.label, {
      size: 9,
      weight: 500,
      color: C.mutedFg,
    });
  }
}

async function main() {
  const client = new FigmaClient();
  console.log(`🔌 Channel: ${CHANNEL}`);
  await client.connect();
  await client.join();

  const doc = await client.cmd("get_document_info", {}, PROBE_MS);
  if (!doc) throw new Error(`Figma plugin not on channel "${CHANNEL}"`);

  const boardW = 40 + CONCEPTS.length * COL_W + 40;
  const board = await client.frame(
    null,
    "LOGO CONCEPTS v5 — Crowd Colors",
    ORIGIN.x,
    ORIGIN.y,
    boardW,
    900,
    { fill: C.white, radius: 20 },
  );
  if (!board) throw new Error("Failed to create board");

  await client.text(board, "title", 40, 24, "LOGO CONCEPTS v5 — Crowd Colors", {
    size: 22,
    weight: 700,
  });
  await client.text(
    board,
    "sub",
    40,
    54,
    "혼잡도 4색 · 여유 #3cb878 · 보통 #5b9bd5 · 혼잡 #8b6cc1 · 매우혼잡 #e06090",
    { size: 12,
      weight: 400,
      color: C.mutedFg,
    },
  );

  // 범례 바
  const legendY = 68;
  const legendColors = [C.relaxed, C.normal, C.busy, C.veryBusy];
  const legendLabels = ["여유 ≤55%", "보통", "혼잡", "매우혼잡 ≥116%"];
  for (let i = 0; i < 4; i++) {
    await client.rect(board, `legend-${i}`, 40 + i * 120, legendY, 100, 12, {
      fill: legendColors[i],
      radius: 4,
    });
    await client.text(board, `legend-t-${i}`, 40 + i * 120, legendY + 16, legendLabels[i], {
      size: 9,
      weight: 500,
      color: C.mutedFg,
    });
  }

  for (let i = 0; i < CONCEPTS.length; i++) {
    console.log(`  Building ${CONCEPTS[i].name}...`);
    await buildColumn(client, board, CONCEPTS[i], i);
    await sleep(120);
  }

  await client.cmd("set_focus", { nodeId: board });
  console.log(`\n✅ v5 crowd-color board at (${ORIGIN.x}, ${ORIGIN.y})`);
  client.ws.close();
}

main().catch((e) => {
  console.error("Fatal:", e.message ?? e);
  process.exit(1);
});
