#!/usr/bin/env bun
/**
 * Logo concepts v3 — subway icon variations for 여유로.
 * Usage: FIGMA_CHANNEL=pv1tgjcu bun scripts/add-figma-logos-v3-subway.mjs
 */
import { randomUUID } from "node:crypto";

const CHANNEL = process.env.FIGMA_CHANNEL ?? process.argv[2] ?? "pv1tgjcu";
const WS_URL = "ws://localhost:3055";
const TO_MS = 90_000;
const PROBE_MS = 15_000;

const ORIGIN = { x: 100, y: 17240 };
const COL_W = 360;

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

/** 정면 열차 — 둥근 몸체 + 전조등 2개 + 녹색 라인 */
async function drawTrainFront(client, p) {
  await client.rect(p, "body", 28, 38, 64, 44, { fill: C.fg, radius: 10 });
  await client.rect(p, "stripe", 28, 68, 64, 6, { fill: C.line2, radius: 2 });
  await client.circle(p, "lamp-l", 38, 50, 14, { fill: C.white });
  await client.circle(p, "lamp-r", 68, 50, 14, { fill: C.white });
  await client.circle(p, "lamp-l-in", 41, 53, 8, { fill: C.blue });
  await client.circle(p, "lamp-r-in", 71, 53, 8, { fill: C.blue });
  await client.rect(p, "roof", 40, 30, 40, 10, { fill: C.fg, radius: 5 });
}

/** 측면 1량 — 몸체 + 바퀴 2 + 앞 녹색 여유 구간 */
async function drawSideCar(client, p) {
  await client.rect(p, "clear-path", 14, 72, 36, 5, { fill: C.green, radius: 2 });
  await client.rect(p, "car", 38, 42, 58, 28, { fill: C.fg, radius: 6 });
  await client.rect(p, "window", 48, 48, 22, 12, { fill: C.white, radius: 3 });
  await client.rect(p, "window-2", 74, 48, 14, 12, { fill: C.white, radius: 3 });
  await client.circle(p, "wheel-l", 48, 72, 12, { fill: C.stroke });
  await client.circle(p, "wheel-r", 78, 72, 12, { fill: C.stroke });
  await client.circle(p, "wheel-l-in", 51, 75, 6, { fill: C.muted });
  await client.circle(p, "wheel-r-in", 81, 75, 6, { fill: C.muted });
}

/** 환승역 링 + 가로 열차 실루엣 */
async function drawTransferTrain(client, p) {
  await client.circle(p, "ring-outer", 22, 22, 76, { stroke: C.stroke, strokeWeight: 3, fill: C.white });
  await client.circle(p, "ring-inner", 36, 36, 48, { fill: C.white });
  await client.rect(p, "train-bar", 24, 54, 72, 14, { fill: C.line2, radius: 7 });
  await client.rect(p, "train-mid", 44, 50, 32, 8, { fill: C.fg, radius: 4 });
  await client.circle(p, "hub", 54, 48, 10, { fill: C.white, stroke: C.fg, strokeWeight: 2 });
}

/** 레일 2줄 + 위에 열차 캡슐 + 레일 사이 여백 강조 */
async function drawTrackGap(client, p) {
  await client.rect(p, "rail-top", 16, 78, 88, 4, { fill: C.mutedFg, radius: 2 });
  await client.rect(p, "rail-bot", 16, 88, 88, 4, { fill: C.mutedFg, radius: 2 });
  await client.rect(p, "tie-1", 30, 78, 4, 14, { fill: C.muted, radius: 1 });
  await client.rect(p, "tie-2", 58, 78, 4, 14, { fill: C.muted, radius: 1 });
  await client.rect(p, "tie-3", 86, 78, 4, 14, { fill: C.muted, radius: 1 });
  await client.rect(p, "train-cap", 32, 48, 56, 22, { fill: C.fg, radius: 11 });
  await client.rect(p, "cap-win", 44, 54, 16, 10, { fill: C.green, radius: 3 });
  await client.rect(p, "cap-gap", 64, 54, 12, 10, { fill: C.white, radius: 3 });
}

/** 지하철 아이콘 + 혼잡도 뱃지(녹) 오버레이 */
async function drawTrainBadge(client, p) {
  await client.rect(p, "icon-bg", 30, 28, 60, 60, { fill: C.muted, radius: 14 });
  await client.rect(p, "mini-body", 38, 44, 44, 32, { fill: C.fg, radius: 8 });
  await client.rect(p, "mini-stripe", 38, 66, 44, 5, { fill: C.line2, radius: 2 });
  await client.circle(p, "mini-l", 46, 52, 8, { fill: C.white });
  await client.circle(p, "mini-r", 66, 52, 8, { fill: C.white });
  await client.circle(p, "badge", 78, 24, 22, { fill: C.green });
  await client.rect(p, "badge-check", 84, 32, 10, 4, { fill: C.white, radius: 2 });
  await client.rect(p, "badge-check-2", 87, 29, 4, 10, { fill: C.white, radius: 2 });
}

/** 열차 + 흐르는 경로 꼬리 */
async function drawTrainTrail(client, p) {
  await client.circle(p, "trail-1", 16, 62, 10, { fill: C.muted });
  await client.circle(p, "trail-2", 32, 58, 10, { fill: C.blue, alpha: 0.55 });
  await client.circle(p, "trail-3", 48, 54, 10, { fill: C.green, alpha: 0.75 });
  await client.rect(p, "body", 58, 40, 42, 36, { fill: C.fg, radius: 8 });
  await client.rect(p, "stripe", 58, 66, 42, 5, { fill: C.line2, radius: 2 });
  await client.circle(p, "win-l", 64, 50, 10, { fill: C.white });
  await client.circle(p, "win-r", 82, 50, 10, { fill: C.white });
}

const CONCEPTS = [
  {
    id: "10",
    name: "Train Front",
    theme: "정면 열차 · 2호선 스트라이프",
    palette: "#1e293b · #00A84D · #5b9bd5",
    type: "front",
  },
  {
    id: "11",
    name: "Side Car",
    theme: "측면 1량 + 여유 구간",
    palette: "#1e293b · #3cb878",
    type: "side",
  },
  {
    id: "12",
    name: "Transfer Hub",
    theme: "환승역 링 + 열차",
    palette: "#1a1a1a · #00A84D",
    type: "transfer",
  },
  {
    id: "13",
    name: "Track & Capsule",
    theme: "레일 위 캡슐 열차",
    palette: "#64748b · #1e293b · #3cb878",
    type: "track",
  },
  {
    id: "14",
    name: "Calm Badge",
    theme: "지하철 아이콘 + 여유 뱃지",
    palette: "#e2e8f0 · #3cb878",
    type: "badge",
  },
];

const DRAWERS = {
  front: drawTrainFront,
  side: drawSideCar,
  transfer: drawTransferTrain,
  track: drawTrackGap,
  badge: drawTrainBadge,
  trail: drawTrainTrail,
};

async function drawDark(client, inner, type) {
  const w = C.white;
  const g = C.green;
  const l2 = C.line2;
  if (type === "front") {
    await client.rect(inner, "d-body", 14, 18, 36, 24, { fill: w, radius: 5 });
    await client.rect(inner, "d-st", 14, 38, 36, 4, { fill: l2, radius: 2 });
    await client.circle(inner, "d-l", 20, 24, 8, { fill: C.fg });
    await client.circle(inner, "d-r", 36, 24, 8, { fill: C.fg });
  } else if (type === "side") {
    await client.rect(inner, "d-path", 6, 38, 18, 3, { fill: g, radius: 1 });
    await client.rect(inner, "d-car", 24, 20, 32, 16, { fill: w, radius: 4 });
    await client.circle(inner, "d-w1", 30, 36, 6, { fill: C.fg });
    await client.circle(inner, "d-w2", 46, 36, 6, { fill: C.fg });
  } else if (type === "transfer") {
    await client.circle(inner, "d-ring", 10, 10, 44, { stroke: w, strokeWeight: 2, fill: C.fg });
    await client.circle(inner, "d-in", 20, 20, 24, { fill: C.fg });
    await client.rect(inner, "d-bar", 14, 32, 36, 8, { fill: l2, radius: 4 });
  } else if (type === "track") {
    await client.rect(inner, "d-r1", 8, 42, 48, 3, { fill: w, alpha: 0.35, radius: 1 });
    await client.rect(inner, "d-r2", 8, 48, 48, 3, { fill: w, alpha: 0.35, radius: 1 });
    await client.rect(inner, "d-cap", 18, 22, 28, 14, { fill: w, radius: 7 });
    await client.rect(inner, "d-win", 24, 26, 10, 6, { fill: g, radius: 2 });
  } else if (type === "badge") {
    await client.rect(inner, "d-bg", 16, 14, 36, 36, { fill: w, alpha: 0.15, radius: 8 });
    await client.rect(inner, "d-tr", 22, 26, 24, 16, { fill: w, radius: 4 });
    await client.circle(inner, "d-b", 44, 12, 12, { fill: g });
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

  await client.text(colFrame, "title", 20, 16, `${concept.id} ${concept.name}`, {
    size: 16,
    weight: 700,
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
    "LOGO CONCEPTS v3 — Subway",
    ORIGIN.x,
    ORIGIN.y,
    boardW,
    860,
    { fill: C.white, radius: 20 },
  );
  if (!board) throw new Error("Failed to create board");

  await client.text(board, "title", 40, 24, "LOGO CONCEPTS v3 — Subway", {
    size: 22,
    weight: 700,
  });
  await client.text(
    board,
    "sub",
    40,
    54,
    "지하철 아이콘 변형 · 5 concepts · Symbol + Typography",
    { size: 13, weight: 400, color: C.mutedFg },
  );

  for (let i = 0; i < CONCEPTS.length; i++) {
    console.log(`  Building ${CONCEPTS[i].name}...`);
    await buildColumn(client, board, CONCEPTS[i], i);
    await sleep(120);
  }

  await client.cmd("set_focus", { nodeId: board });
  console.log(`\n✅ v3 subway board at (${ORIGIN.x}, ${ORIGIN.y})`);
  client.ws.close();
}

main().catch((e) => {
  console.error("Fatal:", e.message ?? e);
  process.exit(1);
});
