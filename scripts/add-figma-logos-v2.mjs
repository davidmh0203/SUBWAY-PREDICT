#!/usr/bin/env bun
/**
 * Move existing logo board + add 5 new logo concepts (v2).
 * Usage: FIGMA_CHANNEL=pv1tgjcu bun scripts/add-figma-logos-v2.mjs
 */
import { randomUUID } from "node:crypto";

const CHANNEL = process.env.FIGMA_CHANNEL ?? process.argv[2] ?? "pv1tgjcu";
const WS_URL = "ws://localhost:3055";
const TO_MS = 90_000;
const PROBE_MS = 15_000;

const EXISTING_BOARD_ID = "47:130";
const MOVE_TO = { x: 100, y: 15200 };
const V2_ORIGIN = { x: 100, y: 16180 };

const C = {
  fg: "#1e293b",
  green: "#3cb878",
  line2: "#00A84D",
  muted: "#e2e8f0",
  mutedFg: "#64748b",
  white: "#ffffff",
  stroke: "#1a1a1a",
  blue: "#5b9bd5",
  purple: "#8b6cc1",
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

  async setStroke(id, color, weight = 2, a = 1) {
    if (!id) return;
    const c = hex(color, a);
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

// ── v1 symbols (for dark preview reuse) ──
async function drawFlowPath(client, parent) {
  await client.circle(parent, "path-green", 18, 38, 14, { fill: C.green });
  await client.rect(parent, "path-curve-1", 28, 42, 44, 10, { fill: C.green, radius: 5 });
  await client.rect(parent, "path-curve-2", 52, 58, 44, 10, { fill: C.fg, radius: 5 });
  await client.circle(parent, "path-end", 78, 68, 12, { fill: C.fg });
}

// ── v2 new symbols ──
async function drawTunnelArch(client, parent) {
  await client.rect(parent, "arch-top", 28, 24, 64, 9, { fill: C.fg, radius: 4 });
  await client.rect(parent, "arch-left", 28, 33, 9, 48, { fill: C.fg, radius: 4 });
  await client.rect(parent, "arch-right", 83, 33, 9, 48, { fill: C.fg, radius: 4 });
  await client.rect(parent, "arch-floor", 28, 74, 64, 6, { fill: C.green, radius: 3 });
}

async function drawWideBreath(client, parent) {
  await client.rect(parent, "bracket-l-top", 22, 32, 28, 8, { fill: C.fg, radius: 4 });
  await client.rect(parent, "bracket-l-bot", 22, 80, 28, 8, { fill: C.fg, radius: 4 });
  await client.rect(parent, "bracket-l-mid", 22, 40, 8, 40, { fill: C.fg, radius: 4 });
  await client.rect(parent, "bracket-r-top", 70, 32, 28, 8, { fill: C.fg, radius: 4 });
  await client.rect(parent, "bracket-r-bot", 70, 80, 28, 8, { fill: C.fg, radius: 4 });
  await client.rect(parent, "bracket-r-mid", 90, 40, 8, 40, { fill: C.fg, radius: 4 });
  await client.circle(parent, "breath-dot", 54, 54, 10, { fill: C.green });
}

async function drawStepDown(client, parent) {
  const bars = [
    { x: 22, h: 58, fill: C.muted },
    { x: 48, h: 42, fill: C.blue },
    { x: 74, h: 28, fill: C.green },
  ];
  for (const b of bars) {
    await client.rect(parent, `step-${b.x}`, b.x, 100 - b.h, 18, b.h, { fill: b.fill, radius: 4 });
  }
}

async function drawSpaceDots(client, parent) {
  await client.circle(parent, "dot-1", 18, 52, 16, { fill: C.muted });
  await client.circle(parent, "dot-2", 48, 48, 14, { fill: C.blue });
  await client.circle(parent, "dot-3", 78, 42, 12, { fill: C.green });
  await client.rect(parent, "link-1", 34, 58, 18, 3, { fill: C.mutedFg, radius: 1.5 });
  await client.rect(parent, "link-2", 62, 54, 20, 3, { fill: C.mutedFg, radius: 1.5 });
}

async function drawSoftWave(client, parent) {
  const pts = [
    { x: 16, y: 62, w: 18 },
    { x: 34, y: 54, w: 18 },
    { x: 52, y: 48, w: 18 },
    { x: 70, y: 54, w: 18 },
    { x: 88, y: 60, w: 14 },
  ];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    await client.rect(parent, `wave-${i}`, p.x, p.y, p.w, 8, {
      fill: i < 3 ? C.fg : C.green,
      radius: 4,
    });
  }
}

async function drawDarkSymbol(client, inner, type) {
  const w = C.white;
  const g = C.green;
  const m = C.muted;
  const drawers = {
    tunnel: async () => {
      await client.rect(inner, "d-arch-t", 12, 10, 40, 5, { fill: w, radius: 2 });
      await client.rect(inner, "d-arch-l", 12, 15, 5, 30, { fill: w, radius: 2 });
      await client.rect(inner, "d-arch-r", 47, 15, 5, 30, { fill: w, radius: 2 });
      await client.rect(inner, "d-floor", 12, 42, 40, 4, { fill: g, radius: 2 });
    },
    breath: async () => {
      await client.rect(inner, "d-bl", 10, 20, 5, 24, { fill: w, radius: 2 });
      await client.rect(inner, "d-br", 50, 20, 5, 24, { fill: w, radius: 2 });
      await client.circle(inner, "d-dot", 30, 30, 8, { fill: g });
    },
    stepdown: async () => {
      await client.rect(inner, "d-s1", 14, 18, 8, 36, { fill: w, alpha: 0.25, radius: 2 });
      await client.rect(inner, "d-s2", 30, 28, 8, 26, { fill: w, alpha: 0.45, radius: 2 });
      await client.rect(inner, "d-s3", 46, 36, 8, 18, { fill: g, radius: 2 });
    },
    spacedots: async () => {
      await client.circle(inner, "d-d1", 12, 32, 10, { fill: w, alpha: 0.3 });
      await client.circle(inner, "d-d2", 30, 28, 9, { fill: w, alpha: 0.55 });
      await client.circle(inner, "d-d3", 48, 24, 8, { fill: g });
    },
    wave: async () => {
      await client.rect(inner, "d-w1", 8, 34, 12, 4, { fill: w, radius: 2 });
      await client.rect(inner, "d-w2", 22, 28, 12, 4, { fill: w, radius: 2 });
      await client.rect(inner, "d-w3", 36, 24, 12, 4, { fill: g, radius: 2 });
      await client.rect(inner, "d-w4", 50, 28, 12, 4, { fill: w, radius: 2 });
    },
    flow: async () => {
      await client.rect(inner, "d-path-1", 8, 28, 30, 6, { fill: g, radius: 3 });
      await client.rect(inner, "d-path-2", 32, 42, 30, 6, { fill: w, radius: 3 });
    },
  };
  if (drawers[type]) await drawers[type]();
}

async function drawSymbol(client, parent, type) {
  const drawers = {
    flow: drawFlowPath,
    tunnel: drawTunnelArch,
    breath: drawWideBreath,
    stepdown: drawStepDown,
    spacedots: drawSpaceDots,
    wave: drawSoftWave,
  };
  if (drawers[type]) await drawers[type](client, parent);
}

const CONCEPTS_V2 = [
  { id: "05", name: "Tunnel Arch", theme: "터널을 지나 여유로", palette: "#1e293b · #3cb878", type: "tunnel" },
  { id: "06", name: "Wide Breath", theme: "숨 쉬는 여백", palette: "#1e293b · #3cb878", type: "breath" },
  { id: "07", name: "Step Down", theme: "혼잡이 내려가다", palette: "#e2e8f0 · #5b9bd5 · #3cb878", type: "stepdown" },
  { id: "08", name: "Space Dots", theme: "점점 넓어지는 길", palette: "#64748b · #3cb878", type: "spacedots" },
  { id: "09", name: "Soft Wave", theme: "여유롭게 흐르다", palette: "#1e293b · #3cb878", type: "wave" },
];

async function buildConceptColumn(client, boardId, concept, col, colWidth = 360) {
  const x0 = 40 + col * colWidth;
  const colFrame = await client.frame(
    boardId,
    `${concept.id} ${concept.name}`,
    x0,
    80,
    colWidth,
    720,
    { fill: C.muted, alpha: 0.35, radius: 16 },
  );
  if (!colFrame) return;

  await client.text(colFrame, "title", 20, 16, `${concept.id} ${concept.name}`, {
    size: 16,
    weight: 700,
    color: C.fg,
  });
  await client.text(colFrame, "theme", 20, 40, concept.theme, {
    size: 12,
    weight: 500,
    color: C.mutedFg,
  });
  await client.text(colFrame, "palette", 20, 58, concept.palette, {
    size: 11,
    weight: 400,
    color: C.mutedFg,
  });

  await client.text(colFrame, "lbl-symbol", 20, 88, "Symbol", { size: 10, weight: 600, color: C.mutedFg });
  const sym = await client.frame(colFrame, "Symbol", 20, 104, 120, 120, { fill: C.white, radius: 12 });
  if (sym) await drawSymbol(client, sym, concept.type);

  await client.text(colFrame, "lbl-lockup", 20, 240, "Lockup", { size: 10, weight: 600, color: C.mutedFg });
  const lock = await client.frame(colFrame, "Lockup", 20, 256, 320, 64, { fill: C.white, radius: 12 });
  if (lock) {
    const mini = await client.frame(lock, "mini-symbol", 12, 8, 48, 48, { fill: C.muted, alpha: 0.5, radius: 8 });
    if (mini) await drawSymbol(client, mini, concept.type);
    await client.text(lock, "wordmark", 72, 16, "여유로", { size: 26, weight: 700, color: C.fg });
  }

  await client.text(colFrame, "lbl-icon", 20, 336, "App Icon 48", { size: 10, weight: 600, color: C.mutedFg });
  const icon = await client.frame(colFrame, "AppIcon", 20, 352, 48, 48, {
    fill: C.white,
    stroke: C.muted,
    strokeWeight: 1,
    radius: 10,
  });
  if (icon) {
    const inner = await client.frame(icon, "icon-inner", 6, 6, 36, 36, { fill: C.muted, alpha: 0.3, radius: 6 });
    if (inner) await drawSymbol(client, inner, concept.type);
  }

  await client.text(colFrame, "lbl-dark", 20, 420, "Dark BG", { size: 10, weight: 600, color: C.mutedFg });
  const dark = await client.frame(colFrame, "DarkPreview", 20, 436, 120, 120, { fill: C.fg, radius: 12 });
  if (dark) {
    const inner = await client.frame(dark, "dark-symbol", 20, 20, 80, 80, { fill: C.fg, radius: 8 });
    if (inner) await drawDarkSymbol(client, inner, concept.type);
  }
}

async function main() {
  const client = new FigmaClient();
  console.log(`🔌 Channel: ${CHANNEL}`);
  await client.connect();
  await client.join();

  const doc = await client.cmd("get_document_info", {}, PROBE_MS);
  if (!doc) throw new Error(`Figma plugin not on channel "${CHANNEL}"`);

  console.log(`✓ Connected — moving board ${EXISTING_BOARD_ID} → (${MOVE_TO.x}, ${MOVE_TO.y})`);
  await client.cmd("move_node", { nodeId: EXISTING_BOARD_ID, x: MOVE_TO.x, y: MOVE_TO.y });

  const boardW = 40 + CONCEPTS_V2.length * 360 + 40;
  const board = await client.frame(
    null,
    "LOGO CONCEPTS v2 — 여유로",
    V2_ORIGIN.x,
    V2_ORIGIN.y,
    boardW,
    860,
    { fill: C.white, radius: 20 },
  );
  if (!board) throw new Error("Failed to create v2 board");

  await client.text(board, "board-title", 40, 24, "LOGO CONCEPTS v2 — 여유로", {
    size: 22,
    weight: 700,
    color: C.fg,
  });
  await client.text(board, "board-sub", 40, 54, "5 new concepts · Symbol + Typography · Flat vector · 단색", {
    size: 13,
    weight: 400,
    color: C.mutedFg,
  });

  for (let i = 0; i < CONCEPTS_V2.length; i++) {
    console.log(`  Building ${CONCEPTS_V2[i].name}...`);
    await buildConceptColumn(client, board, CONCEPTS_V2[i], i);
    await sleep(150);
  }

  await client.cmd("set_focus", { nodeId: board });
  console.log(`\n✅ v2 board created at (${V2_ORIGIN.x}, ${V2_ORIGIN.y})`);
  if (client.failures.length) console.log("Failures:", client.failures);
  client.ws.close();
}

main().catch((e) => {
  console.error("Fatal:", e.message ?? e);
  process.exit(1);
});
