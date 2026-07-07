#!/usr/bin/env bun
/**
 * Update EVENT ICONS board: concert → mic vector, add sports column.
 *
 * Prereqs:
 * 1. Figma Desktop + Cursor Talk to Figma plugin open
 * 2. WebSocket relay: `bun socket` in cursor-talk-to-figma-mcp (port 3055)
 * 3. Copy channel from plugin UI
 *
 * Usage:
 *   FIGMA_CHANNEL=your_channel bun scripts/update-event-icons.mjs
 *   bun scripts/update-event-icons.mjs your_channel
 */
import { randomUUID } from "node:crypto";

const CHANNEL = process.env.FIGMA_CHANNEL ?? process.argv[2] ?? "omqx5fnz";
const WS_URL = "ws://localhost:3055";
const TO_MS = 60_000;
const PROBE_MS = 12_000;

const BOARD_ID = "37:98";
const SUBTITLE_ID = "37:100";
const ROW_IDS = ["37:101", "37:102", "37:103"];

const ROW_STYLES = [
  { mic: "#3363f2", sportsTile: "#d9f7e8", sportsIcon: "#1a9e5c" },
  { mic: "#ffffff", sportsTile: "#45c486", sportsIcon: "#ffffff" },
  { mic: "#5c3d99", sportsTile: "#d0f0dc", sportsIcon: "#2d8f5a" },
];

const SPORTS = { x: 1080, label: "잠실 경기" };

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

  async setFill(id, color, a = 1) {
    if (!id) return;
    const c = hex(color, a);
    await this.cmd("set_fill_color", { nodeId: id, r: c.r, g: c.g, b: c.b, a: c.a });
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

  async rect(pid, name, x, y, w, h, opts = {}) {
    const r = await this.cmd("create_rectangle", {
      parentId: pid,
      name,
      x,
      y,
      width: w,
      height: h,
      cornerRadius: opts.radius ?? 0,
      fillColor: hex(opts.fill ?? "#ffffff", opts.alpha ?? 1),
    });
    const id = this.parseId(r);
    if (id && opts.fill) await this.setFill(id, opts.fill, opts.alpha ?? 1);
    if (id && opts.radius) await this.cmd("set_corner_radius", { nodeId: id, radius: opts.radius });
    return id;
  }

  async text(pid, name, x, y, content, opts = {}) {
    const c = hex(opts.color ?? "#475470");
    const r = await this.cmd("create_text", {
      parentId: pid,
      name,
      x,
      y,
      text: content,
      fontSize: opts.size ?? 13,
      fontWeight: opts.weight ?? 600,
      fontColor: { r: c.r, g: c.g, b: c.b },
    });
    return this.parseId(r);
  }
}

function rowHasSports(row) {
  return (row.children ?? []).some((c) => c.name === "Sports-Glass");
}

function rowHasMic(row) {
  return (row.children ?? []).some((c) => c.name === "Concert-Mic-Icon");
}

function concertGlyphIds(row) {
  return (row.children ?? [])
    .filter((c) => c.type === "TEXT" && (c.characters === "♪" || c.name === "Glyph"))
    .map((c) => c.id);
}

async function drawMic(client, rowId, color) {
  const px = 40;
  const py = 52;
  const gid = await client.cmd("create_frame", {
    parentId: rowId,
    name: "Concert-Mic-Icon",
    x: px + 28,
    y: py + 22,
    width: 74,
    height: 96,
    fillColor: { r: 1, g: 1, b: 1, a: 0 },
  });
  const parent = client.parseId(gid) ?? gid?.id;
  if (!parent) return;

  await client.rect(parent, "mic-head", 17, 0, 40, 52, { fill: color, radius: 20 });
  await client.rect(parent, "mic-grille-1", 24, 14, 26, 3, { fill: color, alpha: 0.35, radius: 1 });
  await client.rect(parent, "mic-grille-2", 24, 22, 26, 3, { fill: color, alpha: 0.35, radius: 1 });
  await client.rect(parent, "mic-grille-3", 24, 30, 26, 3, { fill: color, alpha: 0.35, radius: 1 });
  await client.rect(parent, "mic-stem", 29, 52, 16, 28, { fill: color, radius: 4 });
  await client.rect(parent, "mic-base", 10, 78, 54, 12, { fill: color, radius: 6 });
}

async function drawSportsBall(client, rowId, iconColor, tileFill) {
  const x = SPORTS.x;
  const y = 52;

  await client.rect(rowId, "Sports-Glass", x, y, 130, 130, {
    fill: tileFill,
    alpha: 0.86,
    radius: 40,
  });

  await client.rect(rowId, "Sports-Gloss", x + 20, y + 10, 90, 48, {
    fill: "#ffffff",
    alpha: 0.5,
    radius: 20,
  });

  const gid = await client.cmd("create_frame", {
    parentId: rowId,
    name: "Sports-Ball-Icon",
    x: x + 30,
    y: y + 28,
    width: 70,
    height: 70,
    fillColor: { r: 1, g: 1, b: 1, a: 0 },
  });
  const parent = client.parseId(gid) ?? gid?.id;
  if (!parent) return;

  const ball = await client.rect(parent, "ball", 5, 5, 60, 60, {
    fill: iconColor,
    alpha: 0.95,
    radius: 30,
  });
  if (ball) {
    await client.cmd("set_stroke_color", {
      nodeId: ball,
      r: 1,
      g: 1,
      b: 1,
      a: 0.45,
      weight: 2,
    });
  }
  await client.rect(parent, "ball-patch-1", 22, 14, 16, 10, { fill: "#ffffff", alpha: 0.35, radius: 5 });
  await client.rect(parent, "ball-patch-2", 38, 36, 14, 9, { fill: "#ffffff", alpha: 0.28, radius: 4 });
  await client.rect(parent, "ball-patch-3", 14, 38, 12, 8, { fill: "#ffffff", alpha: 0.22, radius: 4 });

  await client.text(rowId, "Sports-Label", x + 30, y + 144, SPORTS.label, {
    size: 13,
    weight: 600,
    color: "#475470",
  });
}

async function main() {
  const client = new FigmaClient();
  console.log(`🔌 Channel: ${CHANNEL}`);
  await client.connect();
  await client.join();

  const doc = await client.cmd("get_document_info", {}, PROBE_MS);
  if (!doc) {
    throw new Error(
      `Figma plugin not responding on channel "${CHANNEL}".\n` +
        "Open Figma → Cursor Talk to Figma plugin → copy channel → rerun:\n" +
        `  FIGMA_CHANNEL=<channel> bun scripts/update-event-icons.mjs`,
    );
  }
  console.log(`✓ Connected (${(doc.children ?? []).length} top-level nodes)`);

  const board = await client.cmd("get_node_info", { nodeId: BOARD_ID });
  if (!board) throw new Error(`Board ${BOARD_ID} not found`);
  console.log(`✓ Board: ${board.name}`);

  await client.cmd("resize_node", { nodeId: BOARD_ID, width: 1500, height: 900 });
  for (const rowId of ROW_IDS) {
    await client.cmd("resize_node", { nodeId: rowId, width: 1420, height: 230 });
  }

  await client.cmd("set_text_content", {
    nodeId: SUBTITLE_ID,
    text: "글래스모피즘 · 리퀴드글래스 / 콘서트(마이크) · 비 · 점검 · 안내 · 스포츠",
  });

  for (let i = 0; i < ROW_IDS.length; i++) {
    const rowId = ROW_IDS[i];
    const style = ROW_STYLES[i];
    const row = await client.cmd("get_node_info", { nodeId: rowId });
    if (!row) continue;

    for (const glyphId of concertGlyphIds(row)) {
      await client.cmd("delete_node", { nodeId: glyphId });
      await sleep(80);
    }

    if (!rowHasMic(row)) {
      console.log(`  Row ${i + 1}: add mic`);
      await drawMic(client, rowId, style.mic);
    } else {
      console.log(`  Row ${i + 1}: mic exists, skip`);
    }

    if (!rowHasSports(row)) {
      console.log(`  Row ${i + 1}: add sports`);
      await drawSportsBall(client, rowId, style.sportsIcon, style.sportsTile);
    } else {
      console.log(`  Row ${i + 1}: sports exists, skip`);
    }
    await sleep(150);
  }

  await client.cmd("set_focus", { nodeId: BOARD_ID });
  const exported = await client.cmd("export_node_as_image", {
    nodeId: BOARD_ID,
    format: "PNG",
    scale: 1,
  });

  console.log("\n✅ Done");
  if (exported?.imageData) {
    console.log(`   Preview exported (${Math.round((exported.imageData.length * 3) / 4 / 1024)} KB base64)`);
  }
  if (client.failures.length) console.log("Failures:", client.failures);
  client.ws.close();
}

main().catch((e) => {
  console.error("Fatal:", e.message ?? e);
  process.exit(1);
});
