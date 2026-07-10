#!/usr/bin/env bun
/**
 * Build 여유로 logo concept board in Figma (4 styles).
 *
 * Prereqs:
 * 1. Figma Desktop + Cursor Talk to Figma plugin on same channel
 * 2. `bun socket` in cursor-talk-to-figma-mcp (port 3055)
 *
 * Usage:
 *   FIGMA_CHANNEL=yeoyuro bun scripts/build-figma-logos.mjs
 */
import { randomUUID } from "node:crypto";

const CHANNEL = process.env.FIGMA_CHANNEL ?? process.argv[2] ?? "yeoyuro";
const WS_URL = "ws://localhost:3055";
const TO_MS = 90_000;
const PROBE_MS = 15_000;

const C = {
  fg: "#1e293b",
  green: "#3cb878",
  line2: "#00A84D",
  muted: "#e2e8f0",
  mutedFg: "#64748b",
  white: "#ffffff",
  stroke: "#1a1a1a",
  blue: "#5b9bd5",
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
    if (id && opts.radius) {
      await this.cmd("set_corner_radius", { nodeId: id, radius: opts.radius });
    }
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
    if (opts.radius) {
      await this.cmd("set_corner_radius", { nodeId: id, radius: opts.radius });
    }
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

async function drawFlowPath(client, parent) {
  await client.circle(parent, "path-green", 18, 38, 14, { fill: C.green });
  await client.rect(parent, "path-curve-1", 28, 42, 44, 10, { fill: C.green, radius: 5 });
  await client.rect(parent, "path-curve-2", 52, 58, 44, 10, { fill: C.fg, radius: 5 });
  await client.circle(parent, "path-end", 78, 68, 12, { fill: C.fg });
}

async function drawOpenRing(client, parent) {
  // C-shape ring: three arc segments + inner white cutout + bottom gap
  await client.rect(parent, "arc-top", 34, 22, 52, 8, { fill: C.fg, radius: 4 });
  await client.rect(parent, "arc-left", 22, 38, 8, 36, { fill: C.fg, radius: 4 });
  await client.rect(parent, "arc-right", 90, 38, 8, 36, { fill: C.fg, radius: 4 });
  await client.circle(parent, "ring-inner", 32, 32, 56, { fill: C.white });
  await client.rect(parent, "ring-gap", 68, 78, 28, 20, { fill: C.white });
}

async function drawSoftLink(client, parent) {
  await client.circle(parent, "station", 24, 46, 28, {
    fill: C.white,
    stroke: C.stroke,
    strokeWeight: 2.5,
  });
  await client.circle(parent, "station-dot", 35, 57, 6, { fill: C.line2 });
  await client.rect(parent, "route", 54, 55, 52, 10, { fill: C.line2, radius: 5 });
  await client.circle(parent, "route-end", 98, 52, 16, { fill: C.fg, alpha: 0.12 });
}

async function drawCalmMargin(client, parent) {
  const bars = [
    { x: 30, h: 36, fill: C.muted },
    { x: 52, h: 52, fill: C.green },
    { x: 74, h: 36, fill: C.muted },
  ];
  for (const b of bars) {
    await client.rect(parent, `bar-${b.x}`, b.x, 100 - b.h, 16, b.h, {
      fill: b.fill,
      radius: 4,
    });
  }
}

async function drawSymbol(client, parent, type) {
  const drawers = {
    flow: drawFlowPath,
    ring: drawOpenRing,
    link: drawSoftLink,
    margin: drawCalmMargin,
  };
  await drawers[type](client, parent);
}

const CONCEPTS = [
  {
    id: "01",
    name: "Flow Path",
    theme: "여유로운 길",
    palette: "#1e293b · #3cb878",
    type: "flow",
  },
  {
    id: "02",
    name: "Open Ring",
    theme: "ㅇ의 여백 · 열림",
    palette: "#1e293b · #ffffff",
    type: "ring",
  },
  {
    id: "03",
    name: "Soft Link",
    theme: "역에서 이어지는 길",
    palette: "#1a1a1a · #00A84D",
    type: "link",
  },
  {
    id: "04",
    name: "Calm Margin",
    theme: "여유로운 혼잡도",
    palette: "#3cb878 · #e2e8f0",
    type: "margin",
  },
];

async function buildConceptColumn(client, boardId, concept, col) {
  const x0 = 40 + col * 380;
  const colFrame = await client.frame(
    boardId,
    `${concept.id} ${concept.name}`,
    x0,
    80,
    360,
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

  // Symbol 120×120
  await client.text(colFrame, "lbl-symbol", 20, 88, "Symbol", { size: 10, weight: 600, color: C.mutedFg });
  const sym = await client.frame(colFrame, "Symbol", 20, 104, 120, 120, {
    fill: C.white,
    radius: 12,
  });
  if (sym) await drawSymbol(client, sym, concept.type);

  // Lockup
  await client.text(colFrame, "lbl-lockup", 20, 240, "Lockup", { size: 10, weight: 600, color: C.mutedFg });
  const lock = await client.frame(colFrame, "Lockup", 20, 256, 320, 64, {
    fill: C.white,
    radius: 12,
  });
  if (lock) {
    const mini = await client.frame(lock, "mini-symbol", 12, 8, 48, 48, { fill: C.muted, alpha: 0.5, radius: 8 });
    if (mini) await drawSymbol(client, mini, concept.type);
    await client.text(lock, "wordmark", 72, 16, "여유로", { size: 26, weight: 700, color: C.fg });
  }

  // App icon 48×48
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

  // Dark bg preview
  await client.text(colFrame, "lbl-dark", 20, 420, "Dark BG", { size: 10, weight: 600, color: C.mutedFg });
  const dark = await client.frame(colFrame, "DarkPreview", 20, 436, 120, 120, {
    fill: C.fg,
    radius: 12,
  });
  if (dark) {
    const inner = await client.frame(dark, "dark-symbol", 20, 20, 80, 80, { fill: C.fg, radius: 8 });
    if (inner) {
      if (concept.type === "flow") {
        await client.rect(inner, "d-path-1", 8, 28, 30, 6, { fill: C.green, radius: 3 });
        await client.rect(inner, "d-path-2", 32, 42, 30, 6, { fill: C.white, radius: 3 });
      } else if (concept.type === "ring") {
        await client.circle(inner, "d-ring", 10, 10, 60, { stroke: C.white, strokeWeight: 4, fill: C.fg, alpha: 0 });
        await client.circle(inner, "d-ring-cut", 22, 22, 36, { fill: C.fg });
        await client.rect(inner, "d-gap", 48, 58, 20, 14, { fill: C.fg });
      } else if (concept.type === "link") {
        await client.circle(inner, "d-st", 8, 28, 18, { stroke: C.white, strokeWeight: 2, fill: C.fg, alpha: 0 });
        await client.rect(inner, "d-r", 28, 35, 40, 6, { fill: C.green, radius: 3 });
      } else {
        await client.rect(inner, "d-b1", 18, 38, 10, 28, { fill: C.white, alpha: 0.25, radius: 2 });
        await client.rect(inner, "d-b2", 34, 28, 10, 38, { fill: C.green, radius: 2 });
        await client.rect(inner, "d-b3", 50, 38, 10, 28, { fill: C.white, alpha: 0.25, radius: 2 });
      }
    }
  }
}

async function main() {
  const client = new FigmaClient();
  console.log(`🔌 Channel: ${CHANNEL}`);
  await client.connect();
  await client.join();

  const doc = await client.cmd("get_document_info", {}, PROBE_MS);
  if (!doc) {
    throw new Error(
      `Figma plugin not on channel "${CHANNEL}".\n` +
        "1. Figma Desktop → Cursor Talk to Figma plugin\n" +
        "2. ws://localhost:3055 → channel Join (same ID)\n" +
        `3. FIGMA_CHANNEL=${CHANNEL} bun scripts/build-figma-logos.mjs`,
    );
  }
  console.log(`✓ Connected (${(doc.children ?? []).length} top-level nodes)`);

  const board = await client.frame(
    null,
    "LOGO CONCEPTS — 여유로",
    100,
    100,
    1640,
    860,
    { fill: C.white, radius: 20 },
  );
  if (!board) throw new Error("Failed to create board");

  await client.text(board, "board-title", 40, 24, "LOGO CONCEPTS — 여유로", {
    size: 22,
    weight: 700,
    color: C.fg,
  });
  await client.text(board, "board-sub", 40, 54, "4 concepts · Symbol + Typography · Flat vector · 단색", {
    size: 13,
    weight: 400,
    color: C.mutedFg,
  });

  for (let i = 0; i < CONCEPTS.length; i++) {
    console.log(`  Building ${CONCEPTS[i].name}...`);
    await buildConceptColumn(client, board, CONCEPTS[i], i);
    await sleep(200);
  }

  await client.cmd("set_focus", { nodeId: board });
  console.log("\n✅ LOGO CONCEPTS board created");
  if (client.failures.length) console.log("Failures:", client.failures);
  client.ws.close();
}

main().catch((e) => {
  console.error("Fatal:", e.message ?? e);
  process.exit(1);
});
