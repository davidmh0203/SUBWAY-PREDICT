#!/usr/bin/env bun
/**
 * Logo concepts v4 — 5 more 여유로 concepts (subway + brand).
 * Usage: FIGMA_CHANNEL=pv1tgjcu bun scripts/add-figma-logos-v4.mjs
 */
import { randomUUID } from "node:crypto";

const CHANNEL = process.env.FIGMA_CHANNEL ?? process.argv[2] ?? "pv1tgjcu";
const WS_URL = "ws://localhost:3055";
const TO_MS = 90_000;
const PROBE_MS = 15_000;

const ORIGIN = { x: 100, y: 18300 };
const COL_W = 360;

const C = {
  fg: "#1e293b",
  green: "#3cb878",
  line2: "#00A84D",
  line9: "#BDB092",
  line1: "#0052A4",
  muted: "#e2e8f0",
  mutedFg: "#64748b",
  white: "#ffffff",
  stroke: "#1a1a1a",
  blue: "#5b9bd5",
  rose: "#e06090",
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

  async setStroke(id, color, weight = 2) {
    if (!id) return;
    const c = hex(color);
    await this.cmd("set_stroke_color", {
      nodeId: id,
      color: { r: c.r, g: c.g, b: c.b, a: c.a },
      weight,
    });
  }

  async frame(pid, name, x, y, w, h, opts = {}) {
    const fill = opts.fill && (opts.alpha ?? 1) > 0 ? hex(opts.fill, opts.alpha ?? 1) : undefined;
    const stroke = opts.stroke ? hex(opts.stroke) : undefined;
    const r = await this.cmd("create_frame", {
      parentId: pid,
      name,
      x,
      y,
      width: w,
      height: h,
      ...(fill ? { fillColor: fill } : {}),
      ...(stroke ? { strokeColor: stroke, strokeWeight: opts.strokeWeight ?? 2 } : {}),
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
    if (opts.stroke) await this.setStroke(id, opts.stroke, opts.strokeWeight ?? 2);
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

/** 15 — 승강문 열림 + 가운데 여유 틈 */
async function drawDoorGap(client, p) {
  await client.rect(p, "frame-top", 24, 28, 72, 8, { fill: C.fg, radius: 3 });
  await client.rect(p, "door-l", 24, 36, 32, 56, { fill: C.fg, radius: 6 });
  await client.rect(p, "door-r", 64, 36, 32, 56, { fill: C.fg, radius: 6 });
  await client.rect(p, "gap", 52, 44, 16, 40, { fill: C.green, radius: 4 });
  await client.rect(p, "floor", 24, 88, 72, 5, { fill: C.muted, radius: 2 });
  await client.circle(p, "floor-dot", 58, 78, 6, { fill: C.line2 });
}

/** 16 — 노선 컬러 3줄이 열차로 합쳐짐 */
async function drawLineMerge(client, p) {
  await client.rect(p, "ln1", 14, 36, 28, 5, { fill: C.line1, radius: 2 });
  await client.rect(p, "ln2", 14, 48, 36, 5, { fill: C.line2, radius: 2 });
  await client.rect(p, "ln9", 14, 60, 24, 5, { fill: C.line9, radius: 2 });
  await client.rect(p, "merge", 48, 44, 8, 28, { fill: C.muted, radius: 2 });
  await client.rect(p, "train", 56, 40, 40, 36, { fill: C.fg, radius: 8 });
  await client.rect(p, "win", 64, 50, 24, 12, { fill: C.green, radius: 3 });
}

/** 17 — 역 핀 + 안쪽 미니 열차 */
async function drawMapPin(client, p) {
  await client.circle(p, "pin-head", 34, 20, 52, { fill: C.fg });
  await client.circle(p, "pin-hole", 46, 32, 28, { fill: C.white });
  await client.rect(p, "pin-tail", 54, 64, 12, 28, { fill: C.fg, radius: 4 });
  await client.rect(p, "mini-train", 44, 40, 32, 20, { fill: C.line2, radius: 5 });
  await client.circle(p, "mini-l", 48, 46, 6, { fill: C.white });
  await client.circle(p, "mini-r", 66, 46, 6, { fill: C.white });
}

/** 18 — 신호등, 녹색만 켜짐 (여유 상태) */
async function drawGreenSignal(client, p) {
  await client.rect(p, "pole", 54, 48, 12, 48, { fill: C.mutedFg, radius: 4 });
  await client.rect(p, "housing", 34, 20, 52, 72, { fill: C.fg, radius: 10 });
  await client.circle(p, "red", 46, 30, 14, { fill: C.muted });
  await client.circle(p, "amber", 46, 48, 14, { fill: C.muted });
  await client.circle(p, "go", 46, 66, 14, { fill: C.green });
  await client.rect(p, "train-hint", 92, 58, 18, 12, { fill: C.fg, radius: 4 });
  await client.rect(p, "train-h-st", 92, 68, 18, 3, { fill: C.line2, radius: 1 });
}

/** 19 — ㅇ 궤도 위 열차 점 (자유로운 궤적) */
async function drawOrbitTrain(client, p) {
  await client.rect(p, "arc-t", 32, 22, 56, 7, { fill: C.fg, radius: 3 });
  await client.rect(p, "arc-l", 22, 36, 7, 36, { fill: C.fg, radius: 3 });
  await client.rect(p, "arc-r", 91, 36, 7, 36, { fill: C.fg, radius: 3 });
  await client.circle(p, "inner", 34, 34, 52, { fill: C.white });
  await client.rect(p, "gap", 72, 76, 24, 16, { fill: C.white });
  await client.circle(p, "train-dot", 78, 30, 18, { fill: C.line2 });
  await client.rect(p, "dot-body", 82, 34, 10, 10, { fill: C.fg, radius: 3 });
}

/** 20 — 플랫폼 + 열차 사이 여유 간격 */
async function drawPlatformGap(client, p) {
  await client.rect(p, "platform", 14, 72, 92, 8, { fill: C.mutedFg, radius: 2 });
  await client.rect(p, "edge", 14, 68, 92, 4, { fill: C.muted, radius: 1 });
  await client.rect(p, "train", 58, 38, 44, 28, { fill: C.fg, radius: 6 });
  await client.rect(p, "stripe", 58, 60, 44, 4, { fill: C.line2, radius: 2 });
  await client.circle(p, "w1", 66, 46, 8, { fill: C.white });
  await client.circle(p, "w2", 84, 46, 8, { fill: C.white });
  await client.rect(p, "space", 38, 50, 16, 4, { fill: C.green, radius: 2 });
}

const CONCEPTS = [
  { id: "15", name: "Door Gap", theme: "승강문 열림 · 여유 틈", palette: "#1e293b · #3cb878", type: "door" },
  { id: "16", name: "Line Merge", theme: "노선이 하나로 · 최적 경로", palette: "#0052A4 · #00A84D · #BDB092", type: "merge" },
  { id: "17", name: "Station Pin", theme: "역 핀 + 열차", palette: "#1e293b · #00A84D", type: "pin" },
  { id: "18", name: "Green Signal", theme: "신호 녹색 · 여유 상태", palette: "#1e293b · #3cb878", type: "signal" },
  { id: "19", name: "Orbit Train", theme: "ㅇ 궤도 위 열차", palette: "#1e293b · #00A84D", type: "orbit" },
];

const DRAWERS = {
  door: drawDoorGap,
  merge: drawLineMerge,
  pin: drawMapPin,
  signal: drawGreenSignal,
  orbit: drawOrbitTrain,
  platform: drawPlatformGap,
};

async function drawDark(client, inner, type) {
  const w = C.white;
  const g = C.green;
  const l2 = C.line2;
  if (type === "door") {
    await client.rect(inner, "d-l", 10, 14, 16, 28, { fill: w, radius: 3 });
    await client.rect(inner, "d-r", 38, 14, 16, 28, { fill: w, radius: 3 });
    await client.rect(inner, "d-g", 24, 18, 8, 20, { fill: g, radius: 2 });
  } else if (type === "merge") {
    await client.rect(inner, "d-l1", 6, 16, 14, 3, { fill: w, alpha: 0.4, radius: 1 });
    await client.rect(inner, "d-l2", 6, 22, 16, 3, { fill: l2, radius: 1 });
    await client.rect(inner, "d-tr", 28, 18, 22, 16, { fill: w, radius: 4 });
    await client.rect(inner, "d-w", 32, 22, 12, 6, { fill: g, radius: 2 });
  } else if (type === "pin") {
    await client.circle(inner, "d-h", 20, 8, 28, { fill: w });
    await client.circle(inner, "d-hole", 28, 16, 12, { fill: C.fg });
    await client.rect(inner, "d-tr", 30, 22, 12, 8, { fill: l2, radius: 2 });
  } else if (type === "signal") {
    await client.rect(inner, "d-box", 22, 10, 28, 40, { fill: w, radius: 5 });
    await client.circle(inner, "d-go", 29, 38, 8, { fill: g });
    await client.rect(inner, "d-tr", 54, 32, 10, 7, { fill: w, radius: 2 });
  } else if (type === "orbit") {
    await client.rect(inner, "d-at", 18, 10, 28, 4, { fill: w, radius: 2 });
    await client.rect(inner, "d-al", 12, 16, 4, 18, { fill: w, radius: 2 });
    await client.circle(inner, "d-dot", 38, 14, 10, { fill: l2 });
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
    "LOGO CONCEPTS v4 — 여유로",
    ORIGIN.x,
    ORIGIN.y,
    boardW,
    860,
    { fill: C.white, radius: 20 },
  );
  if (!board) throw new Error("Failed to create board");

  await client.text(board, "title", 40, 24, "LOGO CONCEPTS v4 — 여유로", { size: 22, weight: 700 });
  await client.text(board, "sub", 40, 54, "5 more · 지하철+브랜드 · Symbol + Typography", {
    size: 13,
    weight: 400,
    color: C.mutedFg,
  });

  for (let i = 0; i < CONCEPTS.length; i++) {
    console.log(`  Building ${CONCEPTS[i].name}...`);
    await buildColumn(client, board, CONCEPTS[i], i);
    await sleep(120);
  }

  await client.cmd("set_focus", { nodeId: board });
  console.log(`\n✅ v4 board at (${ORIGIN.x}, ${ORIGIN.y})`);
  client.ws.close();
}

main().catch((e) => {
  console.error("Fatal:", e.message ?? e);
  process.exit(1);
});
