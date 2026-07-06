#!/usr/bin/env bun
/**
 * Rebuild 04 노선도 with full metro map + Figma prototype interactions.
 * Usage: bun scripts/rebuild-figma-map.mjs
 *
 * Requires Figma plugin on channel (reload plugin after talk-to-figma-mcp updates).
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const CHANNEL = "hjzmdb7h";
const WS_URL = "ws://localhost:3055";
const TIMEOUT_MS = 120000;

const MAP_FRAME = "8:31";
const ROUTE_FRAME = "8:29";
const SOURCE_METRO = "5:1601";

const VB = { w: 1150.36, h: 1074.59 };
const MAP_INSET = { x: 8, y: 56, w: 342, h: 360 };
const SCALE = Math.min(MAP_INSET.w / VB.w, MAP_INSET.h / VB.h);

const C = {
  bg: "#ffffff",
  fg: "#1e293b",
  muted: "#f1f5f9",
  mutedFg: "#64748b",
  border: "#e2e8f0",
  slate400: "#94a3b8",
  slate600: "#475569",
  slate800: "#1e293b",
  green50: "#f0fdf4",
  green600: "#16a34a",
  green800: "#166534",
  rose50: "#fff1f2",
  rose600: "#e11d48",
  rose800: "#9f1239",
  primary: "#0f172a",
  line2: "#00a44a",
  mapBg: "#fafbfc",
};

const LINE_COLOR_LABELS = {
  "#0054a6": "1호선",
  "#005daa": "1호선",
  "#00a44a": "2호선",
  "#f47d30": "3호선",
  "#00a9dc": "4호선",
  "#936fb1": "5호선",
  "#fda600": "5호선",
  "#ed8000": "6호선",
  "#677718": "7호선",
  "#ea545d": "8호선",
  "#c6b182": "9호선",
  "#9a6292": "신분당선",
  "#d31145": "경의중앙",
  "#178c72": "경춘선",
  "#6789ca": "공항철도",
  "#76c4a3": "경강선",
  "#4ea346": "우이신설",
  "#8fc31e": "2호선(성수지선)",
  "#b0ce18": "경의선",
  "#6fa0ce": "인천1",
  "#3681b7": "인천2",
  "#a4dcff": "인천공항",
  "#ad8605": "김포골드",
  "#f99d1c": "수인분당",
  "#c77539": "서해선",
};

const stations = JSON.parse(
  readFileSync(join(ROOT, "src/lib/generated/metro-stations.json"), "utf8"),
);
const segments = JSON.parse(
  readFileSync(join(ROOT, "src/lib/generated/metro-line-segments.json"), "utf8"),
);

function hex(h, a = 1) {
  const x = h.replace("#", "");
  return {
    r: parseInt(x.slice(0, 2), 16) / 255,
    g: parseInt(x.slice(2, 4), 16) / 255,
    b: parseInt(x.slice(4, 6), 16) / 255,
    a,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getLineLegend() {
  const byKey = new Map();
  for (const seg of segments) {
    const key = LINE_COLOR_LABELS[seg.color.toLowerCase()] ?? seg.color;
    if (!byKey.has(key)) byKey.set(key, seg.color);
  }
  return [...byKey.entries()]
    .map(([name, color]) => ({ name, color }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function scalePoint(x, y) {
  return {
    x: MAP_INSET.x + x * SCALE,
    y: MAP_INSET.y + y * SCALE,
  };
}

function getStationMeta(station) {
  const ENDPOINT_TOL = 8;
  const endpointColors = new Set();
  for (const seg of segments) {
    const nearStart = Math.hypot(seg.x1 - station.x, seg.y1 - station.y) < ENDPOINT_TOL;
    const nearEnd = Math.hypot(seg.x2 - station.x, seg.y2 - station.y) < ENDPOINT_TOL;
    if (nearStart || nearEnd) endpointColors.add(seg.color.toLowerCase());
  }
  const lineKeys = [...endpointColors].map(
    (c) => LINE_COLOR_LABELS[c] ?? c,
  );
  return { isTransfer: lineKeys.length >= 2, lineColor: segments[0]?.color ?? "#0054a6" };
}

class FigmaClient {
  constructor() {
    this.ws = null;
    this.pending = new Map();
    this.failures = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.addEventListener("open", () => resolve());
      this.ws.addEventListener("error", reject);
      this.ws.addEventListener("message", (ev) => {
        let data;
        try {
          data = JSON.parse(ev.data);
        } catch {
          return;
        }
        const id = data?.message?.id ?? data?.id;
        if (id && this.pending.has(id)) {
          const p = this.pending.get(id);
          clearTimeout(p.timer);
          this.pending.delete(id);
          if (data.message?.error) p.reject(new Error(data.message.error));
          else p.resolve(data.message?.result ?? data.message);
        }
      });
    });
  }

  send(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout: ${command}`));
        }
      }, TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(
        JSON.stringify({
          id,
          type: "message",
          channel: CHANNEL,
          message: { id, command, params: { ...params, commandId: id } },
        }),
      );
    });
  }

  join() {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => reject(new Error("Join timeout")), 10000);
      const handler = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.type === "system" && data.message?.result?.includes?.("Connected")) {
          clearTimeout(timer);
          this.ws.removeEventListener("message", handler);
          resolve();
        }
      };
      this.ws.addEventListener("message", handler);
      this.ws.send(JSON.stringify({ id, type: "join", channel: CHANNEL }));
    });
  }

  async cmd(command, params) {
    try {
      return await this.send(command, params);
    } catch (err) {
      this.failures.push({ command, params, error: err.message });
      console.warn(`  ⚠ ${command}: ${err.message}`);
      return null;
    }
  }

  async frame(parentId, name, x, y, w, h, opts = {}) {
    const r = await this.cmd("create_frame", {
      parentId,
      name,
      x,
      y,
      width: w,
      height: h,
      fillColor: hex(opts.fill ?? C.bg),
    });
    if (r?.id && opts.radius) {
      await this.cmd("set_corner_radius", { nodeId: r.id, radius: opts.radius });
    }
    if (r?.id && opts.stroke) {
      await this.cmd("set_stroke_color", {
        nodeId: r.id,
        color: hex(opts.stroke),
        weight: opts.strokeWeight ?? 1,
      });
    }
    return r;
  }

  async rect(parentId, name, x, y, w, h, opts = {}) {
    const r = await this.cmd("create_rectangle", { parentId, name, x, y, width: w, height: h });
    if (r?.id) {
      await this.cmd("set_fill_color", { nodeId: r.id, color: hex(opts.fill ?? C.bg, opts.alpha ?? 1) });
      if (opts.radius) await this.cmd("set_corner_radius", { nodeId: r.id, radius: opts.radius });
      if (opts.stroke) {
        await this.cmd("set_stroke_color", {
          nodeId: r.id,
          color: hex(opts.stroke),
          weight: opts.strokeWeight ?? 1,
        });
      }
    }
    return r;
  }

  async text(parentId, name, x, y, content, opts = {}) {
    return this.cmd("create_text", {
      parentId,
      name,
      x,
      y,
      text: content,
      fontSize: opts.size ?? 14,
      fontWeight: opts.weight ?? 400,
      fontColor: hex(opts.color ?? C.fg),
    });
  }

  async annotate(nodeId, markdown) {
    return this.cmd("set_annotation", { nodeId, labelMarkdown: markdown });
  }

  async react(nodeId, destinationId) {
    return this.cmd("set_reaction", { nodeId, destinationId });
  }
}

async function clearFrame(client, frameId) {
  const infos = await client.cmd("get_nodes_info", { nodeIds: [frameId] });
  const frame = Array.isArray(infos) ? infos[0] : infos;
  const ids = frame?.children?.map((c) => c.id) ?? [];
  if (!ids.length) return;
  console.log(`  Clearing ${ids.length} children from ${frameId}...`);
  await client.cmd("delete_multiple_nodes", { nodeIds: ids });
  await sleep(500);
}

async function buildBottomNav(client, parentId) {
  const tabs = [
    { label: "홈", icon: "🏠" },
    { label: "경로", icon: "🛤" },
    { label: "상세", icon: "📋" },
    { label: "노선도", icon: "🗺", active: true },
  ];
  const nav = await client.frame(parentId, "Bottom Nav", 0, 780, 390, 64, {
    fill: C.bg,
    stroke: C.border,
  });
  if (!nav?.id) return nav;
  const tabW = 390 / 4;
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i];
    await client.text(nav.id, `Tab ${t.label}`, i * tabW + tabW / 2 - 16, 8, t.icon, { size: 18 });
    await client.text(nav.id, `Label ${t.label}`, i * tabW + tabW / 2 - 14, 32, t.label, {
      size: 10,
      weight: t.active ? 700 : 400,
      color: t.active ? C.fg : C.mutedFg,
    });
    if (t.active) {
      await client.rect(nav.id, `Active ${t.label}`, i * tabW + tabW / 2 - 12, 52, 24, 3, {
        fill: C.line2,
        radius: 2,
      });
    }
  }
  return nav;
}

async function buildPills(client, pid, dep, arr, depActive = true, arrActive = false) {
  const depPill = await client.frame(pid, "[tap] Departure Pill", 16, 64, 175, 52, {
    fill: depActive ? C.green50 : C.muted,
    radius: 12,
    stroke: depActive ? C.green600 : C.border,
    strokeWeight: depActive ? 2 : 1,
  });
  if (depPill?.id) {
    await client.text(depPill.id, "Dep Label", 12, 8, "출발", {
      size: 9,
      color: depActive ? C.green600 : C.mutedFg,
    });
    await client.text(depPill.id, "Dep Value", 12, 24, dep, {
      size: 13,
      weight: 600,
      color: depActive ? C.green800 : C.slate600,
    });
  }

  const arrPill = await client.frame(pid, "[tap] Destination Pill", 199, 64, 175, 52, {
    fill: arrActive ? C.rose50 : C.muted,
    radius: 12,
    stroke: arrActive ? C.rose600 : C.border,
    strokeWeight: arrActive ? 2 : 1,
  });
  if (arrPill?.id) {
    await client.text(arrPill.id, "Arr Label", 12, 8, "도착", {
      size: 9,
      color: arrActive ? C.rose600 : C.mutedFg,
    });
    await client.text(arrPill.id, "Arr Value", 12, 24, arr, {
      size: 13,
      weight: 600,
      color: arrActive ? C.rose800 : C.slate600,
    });
  }
  return { depPill, arrPill };
}

async function buildLegend(client, parentId, y, activeLine = null) {
  const lines = getLineLegend();
  const rows = 3;
  const perRow = Math.ceil((lines.length + 1) / rows);
  const legendH = 24 + rows * 24;

  const legend = await client.frame(parentId, "Line Legend", 16, y, 358, legendH, {
    fill: C.muted,
    radius: 10,
  });
  if (!legend?.id) return { legend, chips: [] };

  const chips = [];
  const allItems = [{ name: "전체", color: C.slate800, key: null }, ...lines.map((l) => ({ ...l, key: l.name }))];

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const active = activeLine === item.key;
    const chipW = item.key === null ? 34 : Math.min(54, 6 + item.name.length * 7);
    const x = 6 + col * 58;
    const chipY = 6 + row * 22;

    const chip = await client.frame(
      legend.id,
      `[tap] filter:${item.key ?? "전체"}`,
      x,
      chipY,
      chipW,
      18,
      {
        fill: item.key === null && active ? C.slate800 : C.bg,
        radius: 9,
        stroke: active && item.key ? item.color : C.border,
        strokeWeight: active ? 2 : 1,
      },
    );
    if (chip?.id) {
      if (item.key) {
        await client.rect(chip.id, "Swatch", 4, 5, 8, 8, { fill: item.color, radius: 2 });
        await client.text(chip.id, "Label", 14, 3, item.name, {
          size: 6.5,
          weight: active ? 700 : 400,
          color: C.slate800,
        });
      } else {
        await client.text(chip.id, "Label", 6, 3, "전체", {
          size: 7,
          weight: 600,
          color: active ? "#ffffff" : C.mutedFg,
        });
      }
      chips.push({ id: chip.id, line: item.key });
    }
    await sleep(25);
  }

  return { legend, chips };
}

async function embedMetroMap(client, mapAreaId) {
  const scaledW = VB.w * SCALE;
  const scaledH = VB.h * SCALE;

  const cloned = await client.cmd("clone_node", {
    nodeId: SOURCE_METRO,
    parentId: mapAreaId,
    x: MAP_INSET.x,
    y: MAP_INSET.y,
  });

    if (cloned?.id) {
    await client.cmd("resize_node", { nodeId: cloned.id, width: scaledW, height: scaledH });
    console.log(`  ✓ Metro map cloned: ${cloned.id} (${scaledW.toFixed(0)}×${scaledH.toFixed(0)})`);
    return cloned;
  }

  // Fallback: import SVG
  const svg = readFileSync(join(ROOT, "figma-export/metro-map.svg"), "utf8");
  const imported = await client.cmd("import_svg", {
    svg,
    parentId: mapAreaId,
    x: MAP_INSET.x,
    y: MAP_INSET.y,
    width: scaledW,
    height: scaledH,
    name: "Metro Map (SVG)",
  });
  if (imported?.id) {
    console.log(`  ✓ Metro map imported via SVG: ${imported.id}`);
    return imported;
  }

  console.warn("  ✗ Could not embed metro map — reload Figma plugin and retry");
  return null;
}

async function buildStationHits(client, overlayId, stationNames, role = "pick") {
  const hits = [];
  for (const name of stationNames) {
    const station = stations.find((s) => s.name === name);
    if (!station) continue;
    const meta = getStationMeta(station);
    const { x, y } = scalePoint(station.x, station.y);
    const r = meta.isTransfer ? 14 : 10;
    const hit = await client.frame(overlayId, `[tap] station:${name}`, x - r, y - r, r * 2, r * 2, {
      fill: C.bg,
      radius: r,
    });
    if (hit?.id) {
      await client.cmd("set_fill_color", { nodeId: hit.id, color: { ...hex(C.bg), a: 0.01 } });
      await client.annotate(
        hit.id,
        `**역 선택**\n- ON_CLICK: ${role === "pick" ? "출발/도착 지정" : "역 정보"}\n- 역: ${name}역`,
      );
      hits.push({ id: hit.id, name });
    }
    await sleep(40);
  }
  return hits;
}

async function buildZoomControls(client, mapAreaId) {
  const controls = await client.frame(mapAreaId, "Zoom Controls", 298, 8, 52, 88, {
    fill: C.bg,
    radius: 8,
  });
  if (!controls?.id) return null;
  const btns = [
    { label: "+", name: "[tap] zoom:in" },
    { label: "−", name: "[tap] zoom:out" },
    { label: "⛶", name: "[tap] zoom:fit" },
  ];
  const ids = [];
  for (let i = 0; i < btns.length; i++) {
    const b = await client.frame(controls.id, btns[i].name, 6, 6 + i * 26, 40, 22, {
      fill: C.muted,
      radius: 6,
    });
    if (b?.id) {
      await client.text(b.id, "Icon", 14, 4, btns[i].label, { size: 12, color: C.slate600 });
      await client.annotate(b.id, `**${btns[i].label}**\nON_CLICK: 지도 확대/축소/맞춤`);
      ids.push(b.id);
    }
  }
  return { controls, ids };
}

async function buildMapScreen(client, pid, opts = {}) {
  const {
    title = "04 노선도 · 기본",
    dep = "역을 선택하세요",
    arr = "역을 선택하세요",
    depActive = false,
    arrActive = false,
    activeLine = null,
    time = "18:30",
    showRoute = false,
  } = opts;

  await client.text(pid, "Title", 16, 16, "수도권 전철 노선도", { size: 17, weight: 700, color: C.fg });
  await client.text(pid, "Subtitle", 16, 40, "역 탭 출발·도착 · 호선 탭 강조 · 드래그·핀치 확대", {
    size: 9,
    color: C.mutedFg,
  });

  const pills = await buildPills(client, pid, dep, arr, depActive, arrActive);

  const timeBar = await client.frame(pid, "Time Chips", 16, 124, 358, 36, { fill: C.muted, radius: 12 });
  const times = ["17:30", "18:00", "18:30", "19:00", "19:30"];
  const timeChips = [];
  if (timeBar?.id) {
    for (let i = 0; i < times.length; i++) {
      const active = times[i] === time;
      let chipId = null;
      if (active) {
        const bg = await client.rect(timeBar.id, `Chip BG ${times[i]}`, 4 + i * 70, 4, 66, 28, {
          fill: C.bg,
          radius: 8,
        });
        chipId = bg?.id;
      }
      const t = await client.text(timeBar.id, `[tap] time:${times[i]}`, 18 + i * 70, 12, times[i], {
        size: 11,
        weight: active ? 600 : 400,
        color: active ? C.slate800 : C.mutedFg,
      });
      if (t?.id) timeChips.push(t.id);
    }
  }

  const { legend, chips: legendChips } = await buildLegend(client, pid, 168, activeLine);

  const mapArea = await client.frame(pid, "Metro Map Area", 16, 168 + 82, 358, 376, {
    fill: C.mapBg,
    radius: 12,
    stroke: C.border,
  });

  let mapNode = null;
  let overlay = null;
  if (mapArea?.id) {
    mapNode = await embedMetroMap(client, mapArea.id);
    overlay = await client.frame(mapArea.id, "Interactive Overlay", 0, 0, 358, 428, {
      fill: C.bg,
    });
    if (overlay?.id) {
      await client.cmd("set_fill_color", {
        nodeId: overlay.id,
        color: { ...hex(C.bg), a: 0 },
      });
      await buildZoomControls(client, mapArea.id);
      const hitNames = ["신도림", "강남", "사당", "잠실", "홍대입구", "서울", "여의도", "판교", "송파", "구로"];
      await buildStationHits(client, overlay.id, hitNames);
    }

    if (showRoute) {
      const 신도림 = stations.find((s) => s.name === "신도림");
      const 강남 = stations.find((s) => s.name === "강남");
      if (신도림 && 강남) {
        const a = scalePoint(신도림.x, 신도림.y);
        const b = scalePoint(강남.x, 강남.y);
        await client.rect(mapArea.id, "Route Glow", Math.min(a.x, b.x), Math.min(a.y, b.y), 4, Math.abs(b.y - a.y) + 8, {
          fill: "#8b6cc1",
          radius: 2,
          alpha: 0.6,
        });
      }
      await client.text(mapArea.id, "Route Label", 80, 400, "신도림 → 강남 (2호선 직통 · 혼잡)", {
        size: 9,
        color: C.mutedFg,
      });
    }
  }

  const searchBtn = await client.rect(pid, "[tap] Search Button", 16, 668, 358, 44, {
    fill: C.primary,
    radius: 12,
  });
  if (searchBtn?.id) {
    await client.text(pid, "Search Label", 131, 680, "경로 예측 검색", {
      size: 14,
      weight: 600,
      color: "#ffffff",
    });
    await client.annotate(
      searchBtn.id,
      "**경로 검색**\nON_CLICK → `02 경로` 화면으로 이동\n(출발·도착 모두 선택 시 활성)",
    );
  }

  await client.text(pid, "Footer", 16, 720, `혼잡도 시뮬레이션 ${time} · 프로토타입 재생으로 테스트`, {
    size: 9,
    color: C.slate400,
  });

  const nav = await buildBottomNav(client, pid);

  return { pills, legend, legendChips, mapArea, mapNode, overlay, searchBtn, timeChips, nav };
}

async function createPrototypeStates(client, parentId = "8:27") {
  const states = [];
  const stateDefs = [
    { name: "04b · 출발 선택", dep: "신도림역", arr: "역을 선택하세요", depActive: true, arrActive: false },
    { name: "04c · 출발·도착", dep: "신도림역", arr: "강남역", depActive: true, arrActive: true, showRoute: true },
    { name: "04d · 2호선 강조", dep: "신도림역", arr: "강남역", depActive: true, arrActive: true, activeLine: "2호선", showRoute: true },
  ];

  const parentInfo = await client.cmd("get_nodes_info", { nodeIds: [MAP_FRAME] });
  const mapFrame = Array.isArray(parentInfo) ? parentInfo[0] : parentInfo;
  const relX = (mapFrame?.absoluteBoundingBox?.x ?? 2562) - 1200;
  const relY = (mapFrame?.absoluteBoundingBox?.y ?? 128) - 80;

  for (let i = 0; i < stateDefs.length; i++) {
    const def = stateDefs[i];
    const frame = await client.frame(parentId, def.name, relX + (i + 1) * 438, relY, 390, 844, {
      fill: C.bg,
      stroke: C.border,
    });
    if (!frame?.id) continue;
    await buildMapScreen(client, frame.id, def);
    states.push({ id: frame.id, ...def });
    console.log(`  ✓ Prototype state: ${def.name} (${frame.id})`);
    await sleep(500);
  }

  return states;
}

async function findStationHits(client, frameId) {
  const info = await client.cmd("get_nodes_info", { nodeIds: [frameId] });
  const frame = Array.isArray(info) ? info[0] : info;
  const hits = [];

  function walk(node) {
    if (node?.name?.startsWith("[tap] station:")) hits.push({ id: node.id, name: node.name });
    for (const child of node?.children ?? []) walk(child);
  }
  walk(frame);
  return hits;
}

async function wirePrototypes(client, main, states) {
  const mainFrame = MAP_FRAME;
  const [depState, routeState, lineState] = states;

  const hitFrames = await findStationHits(client, mainFrame);

  for (const hit of hitFrames) {
    if (hit.name.includes("신도림") && depState?.id) {
      await client.react(hit.id, depState.id);
    } else if (hit.name.includes("강남") && routeState?.id) {
      await client.react(hit.id, routeState.id);
    }
  }

  for (const chip of main.legendChips ?? []) {
    if (chip.line === "2호선" && lineState?.id) {
      await client.react(chip.id, lineState.id);
    }
    if (chip.line === null && mainFrame) {
      await client.react(chip.id, mainFrame);
    }
  }

  if (main.searchBtn?.id && ROUTE_FRAME) {
    await client.react(main.searchBtn.id, ROUTE_FRAME);
  }

  const connections = [];
  if (main.searchBtn?.id && ROUTE_FRAME) {
    connections.push({ startNodeId: main.searchBtn.id, endNodeId: ROUTE_FRAME, text: "검색" });
  }
  for (const hit of hitFrames.slice(0, 2)) {
    const dest = hit.name.includes("신도림") ? depState?.id : routeState?.id;
    if (dest) connections.push({ startNodeId: hit.id, endNodeId: dest, text: "tap" });
  }
  if (connections.length) {
    await client.cmd("create_connections", { connections });
  }
}

async function findFramesByPrefix(client, parentId, prefix) {
  const info = await client.cmd("get_nodes_info", { nodeIds: [parentId] });
  const parent = Array.isArray(info) ? info[0] : info;
  return (parent?.children ?? []).filter((c) => c.name?.startsWith(prefix));
}

async function runWireOnly(client) {
  const mainFrame = MAP_FRAME;
  const states = await findFramesByPrefix(client, "8:27", "04");
  const depState = states.find((s) => s.name.includes("출발 선택"));
  const routeState = states.find((s) => s.name.includes("출발·도착"));
  const lineState = states.find((s) => s.name.includes("2호선"));

  const main = {
    legendChips: [],
    searchBtn: null,
  };

  const mainInfo = await client.cmd("get_nodes_info", { nodeIds: [mainFrame] });
  const mainNode = Array.isArray(mainInfo) ? mainInfo[0] : mainInfo;

  function walk(node, acc = { chips: [], search: null }) {
    if (node?.name?.startsWith("[tap] filter:")) acc.chips.push({ id: node.id, line: node.name.replace("[tap] filter:", "") });
    if (node?.name === "[tap] Search Button") acc.search = { id: node.id };
    for (const c of node?.children ?? []) walk(c, acc);
    return acc;
  }
  const found = walk(mainNode);
  main.legendChips = found.chips.map((c) => ({
    id: c.id,
    line: c.line === "전체" ? null : c.line,
  }));
  main.searchBtn = found.search;

  await wirePrototypes(client, main, [
    depState ? { id: depState.id } : null,
    routeState ? { id: routeState.id } : null,
    lineState ? { id: lineState.id } : null,
  ].filter(Boolean));

  console.log("Wired reactions. Open Prototype panel (▶) to test.");
}

async function main() {
  const client = new FigmaClient();
  console.log("Connecting...");
  await client.connect();
  await client.join();
  console.log(`Channel: ${CHANNEL}`);

  const probe = await client.cmd("get_document_info", {});
  if (!probe) throw new Error("Figma plugin not connected");
  console.log(`Document: ${probe.name}`);

  console.log("\n🗑 Clearing 04 노선도...");
  await clearFrame(client, MAP_FRAME);

  console.log("\n🗺 Building interactive map (all lines)...");
  const main = await buildMapScreen(client, MAP_FRAME, {
    dep: "역을 선택하세요",
    arr: "역을 선택하세요",
  });

  console.log("\n📱 Creating prototype states...");
  const states = await createPrototypeStates(client);

  console.log("\n🔗 Wiring prototype reactions...");
  await wirePrototypes(client, main, states);

  console.log("\n✅ Done");
  console.log(
    JSON.stringify(
      {
        channel: CHANNEL,
        mapFrame: MAP_FRAME,
        lines: getLineLegend().length,
        stations: stations.length,
        prototypeStates: states.map((s) => ({ id: s.id, name: s.name })),
        failures: client.failures.length,
        failureSample: client.failures.slice(0, 5),
      },
      null,
      2,
    ),
  );

  client.ws.close();
}

if (process.argv.includes("--wire-only")) {
  (async () => {
    const client = new FigmaClient();
    await client.connect();
    await client.join();
    await runWireOnly(client);
    client.ws.close();
  })().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
} else {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
