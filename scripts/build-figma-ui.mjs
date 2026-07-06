#!/usr/bin/env bun
/**
 * Build SUBWAY PREDICT dashboard UI directly in Figma via WebSocket relay.
 * Usage: bun scripts/build-figma-ui.mjs
 */
import { randomUUID } from "node:crypto";

const CHANNEL = "hjzmdb7h";
const WS_URL = "ws://localhost:3055";
const TIMEOUT_MS = 60000;

const FRAMES = {
  home: "8:28",
  route: "8:29",
  detail: "8:30",
  map: "8:31",
};

const PLACEHOLDERS = [
  "8:32", "8:33", "8:34", "8:35", "8:36",
  "8:37", "8:38", "8:39", "8:40", "8:41",
];

const C = {
  bg: "#ffffff",
  fg: "#1e293b",
  muted: "#f1f5f9",
  mutedFg: "#64748b",
  border: "#e2e8f0",
  slate400: "#94a3b8",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  amber50: "#fffbeb",
  amber800: "#92400e",
  rose700: "#be123c",
  rose800: "#9f1239",
  green50: "#f0fdf4",
  green600: "#16a34a",
  green800: "#166534",
  rose50: "#fff1f2",
  rose600: "#e11d48",
  primary: "#0f172a",
  line2: "#00a44a",
  line9: "#c6b182",
  line1: "#0054a6",
  crowd: { RELAXED: "#3cb878", NORMAL: "#5b9bd5", BUSY: "#8b6cc1", VERY_BUSY: "#e06090" },
};

function hex(h, a = 1) {
  const x = h.replace("#", "");
  return {
    r: parseInt(x.slice(0, 2), 16) / 255,
    g: parseInt(x.slice(2, 4), 16) / 255,
    b: parseInt(x.slice(4, 6), 16) / 255,
    a,
  };
}

class FigmaClient {
  constructor() {
    this.ws = null;
    this.pending = new Map();
    this.created = [];
    this.failures = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.addEventListener("open", () => resolve());
      this.ws.addEventListener("error", (e) => reject(e));
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
          if (data.message?.error) {
            p.reject(new Error(data.message.error));
          } else {
            p.resolve(data.message?.result ?? data.message);
          }
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
      const result = await this.send(command, params);
      this.created.push({ command, params, result });
      return result;
    } catch (err) {
      this.failures.push({ command, params, error: err.message });
      console.warn(`  ⚠ ${command}: ${err.message}`);
      return null;
    }
  }

  async deleteNode(id) {
    return this.cmd("delete_node", { nodeId: id });
  }

  async setFill(nodeId, fill, a = 1) {
    if (!nodeId) return;
    await this.cmd("set_fill_color", { nodeId, color: hex(fill, a) });
  }

  async setStroke(nodeId, stroke, weight = 1, a = 1) {
    if (!nodeId) return;
    await this.cmd("set_stroke_color", { nodeId, color: hex(stroke, a), weight });
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
      ...opts.layout,
    });
    if (r?.id && opts.radius) {
      await this.cmd("set_corner_radius", { nodeId: r.id, radius: opts.radius });
    }
    if (r?.id && opts.stroke) {
      await this.setStroke(r.id, opts.stroke, opts.strokeWeight ?? 1);
    }
    return r;
  }

  async rect(parentId, name, x, y, w, h, opts = {}) {
    const r = await this.cmd("create_rectangle", { parentId, name, x, y, width: w, height: h });
    if (r?.id) {
      await this.setFill(r.id, opts.fill ?? C.bg);
      if (opts.radius) await this.cmd("set_corner_radius", { nodeId: r.id, radius: opts.radius });
      if (opts.stroke) await this.setStroke(r.id, opts.stroke, opts.strokeWeight ?? 1);
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
}

async function buildBottomNav(client, parentId, active) {
  const tabs = [
    { id: "home", label: "홈", icon: "🏠" },
    { id: "route", label: "경로", icon: "🛤" },
    { id: "detail", label: "상세", icon: "📋" },
    { id: "map", label: "노선도", icon: "🗺" },
  ];
  const nav = await client.frame(parentId, "Bottom Nav", 0, 780, 390, 64, {
    fill: C.bg,
    stroke: C.border,
    strokeWeight: 1,
  });
  if (!nav?.id) return nav;
  const tabW = 390 / 4;
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i];
    const isActive = t.id === active;
    await client.text(nav.id, `Tab ${t.label}`, i * tabW + tabW / 2 - 16, 8, t.icon, { size: 18 });
    await client.text(nav.id, `Label ${t.label}`, i * tabW + tabW / 2 - 14, 32, t.label, {
      size: 10,
      weight: isActive ? 700 : 400,
      color: isActive ? C.fg : C.mutedFg,
    });
    if (isActive) {
      await client.rect(nav.id, `Active ${t.label}`, i * tabW + tabW / 2 - 12, 52, 24, 3, {
        fill: C.line2,
        radius: 2,
      });
    }
  }
  return nav;
}

async function buildHome(client) {
  const pid = FRAMES.home;
  console.log("\n📱 01 홈");

  const header = await client.frame(pid, "Header", 16, 16, 358, 44);
  if (header?.id) {
    await client.text(header.id, "Settings", 0, 10, "⚙", { size: 18, color: C.slate600 });
    await client.text(header.id, "Title", 90, 8, "SUBWAY PREDICT", { size: 16, weight: 700, color: C.slate800 });
    await client.text(header.id, "Train", 72, 10, "🚇", { size: 16 });
    await client.text(header.id, "Profile", 334, 10, "👤", { size: 18, color: C.slate600 });
  }

  const alert = await client.frame(pid, "Alert Card", 16, 72, 358, 110, {
    fill: C.amber50,
    radius: 12,
  });
  if (alert?.id) {
    await client.text(alert.id, "Alert Title", 16, 12, "🔔 오늘의 정체 예보", {
      size: 13,
      weight: 600,
      color: C.amber800,
    });
    await client.text(alert.id, "Alert Body 1", 16, 36, "🌧️ 18:00 퇴근길 비 예보 + 🎤 잠실 콘서트(2만명)", {
      size: 12,
      color: C.slate700,
    });
    await client.text(alert.id, "Alert Body 2", 16, 58, "→ 2호선 사당-잠실 구간 18시~20시 혼잡도 140% 폭증 예상", {
      size: 12,
      color: C.rose700,
      weight: 500,
    });
  }

  await client.text(pid, "Section Search", 16, 200, "어디로 이동하시나요?", { size: 13, color: C.slate600 });

  const search = await client.frame(pid, "Search Card", 16, 224, 358, 240, {
    fill: C.bg,
    radius: 12,
    stroke: C.border,
    strokeWeight: 1,
  });
  if (search?.id) {
    await client.text(search.id, "Dep Label", 16, 16, "📍 출발", { size: 11, color: C.mutedFg });
    await client.rect(search.id, "Dep Input", 16, 36, 326, 40, { fill: C.muted, radius: 12 });
    await client.text(search.id, "Dep Value", 28, 48, "신도림역", { size: 13, color: C.slate800 });

    await client.text(search.id, "Arr Label", 16, 88, "도착", { size: 11, color: C.mutedFg });
    await client.rect(search.id, "Arr Input", 16, 108, 326, 40, { fill: C.muted, radius: 12 });
    await client.text(search.id, "Arr Value", 28, 120, "강남역", { size: 13, color: C.slate800 });

    await client.rect(search.id, "Time Picker", 16, 160, 326, 36, { fill: C.muted, radius: 10 });
    await client.text(search.id, "Time Value", 28, 170, "🕐 18:30 출발", { size: 12, color: C.slate700 });

    const btn = await client.rect(search.id, "Search Button", 16, 204, 326, 44, { fill: C.primary, radius: 12 });
    if (btn?.id) {
      await client.text(search.id, "Search Btn Text", 115, 216, "경로 예측 검색", {
        size: 14,
        weight: 600,
        color: "#ffffff",
      });
    }
  }

  await client.text(pid, "Section Fav", 16, 480, "⭐ 자주 가는 쾌적 경로", { size: 13, color: C.slate600 });

  const fav = await client.frame(pid, "Favorite Card", 16, 504, 358, 90, {
    fill: C.bg,
    radius: 12,
    stroke: C.border,
    strokeWeight: 1,
  });
  if (fav?.id) {
    await client.text(fav.id, "Fav Title", 16, 14, "🏠 집 ➔ 🏢 회사 (2호선 오피스 라인)", {
      size: 13,
      weight: 500,
      color: C.slate800,
    });
    await client.text(fav.id, "Fav Meta", 16, 40, "소요시간 32분  |  현재: 🟢 여유", {
      size: 12,
      color: C.mutedFg,
    });
    await client.rect(fav.id, "Warning Badge", 16, 62, 120, 20, { fill: C.amber50, radius: 6 });
    await client.text(fav.id, "Warning Text", 22, 65, "30분 뒤 🟡 주의 예상", { size: 9, color: C.amber800 });
  }

  const nav = await buildBottomNav(client, pid, "home");
  return { header, alert, search, fav, nav };
}

async function buildRoute(client) {
  const pid = FRAMES.route;
  console.log("\n📱 02 경로");

  const header = await client.frame(pid, "Header", 16, 16, 358, 48);
  if (header?.id) {
    await client.text(header.id, "Back", 0, 8, "←", { size: 20, color: C.slate600 });
    await client.text(header.id, "Sub", 36, 4, "경로 검색 결과", { size: 11, color: C.mutedFg });
    await client.text(header.id, "Title", 36, 20, "신도림역 → 강남역", { size: 15, weight: 600, color: C.slate800 });
  }

  const timeCard = await client.frame(pid, "Time Slider Card", 16, 76, 358, 280, {
    fill: C.bg,
    radius: 12,
    stroke: C.border,
    strokeWeight: 1,
  });
  if (timeCard?.id) {
    await client.text(timeCard.id, "Hint", 16, 12, "출발 시각을 조절하면 아래 차트가 갱신됩니다", {
      size: 10,
      color: C.mutedFg,
    });
    const marks = ["17:30", "18:00", "18:30", "19:00", "19:30"];
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i];
      const x = 16 + i * 68;
      await client.text(timeCard.id, `Mark ${m}`, x, 36, m, {
        size: 10,
        weight: m === "18:30" ? 700 : 400,
        color: m === "18:30" ? C.slate800 : C.slate400,
      });
    }
    await client.rect(timeCard.id, "Slider Track", 16, 58, 326, 4, { fill: C.muted, radius: 2 });
    await client.rect(timeCard.id, "Slider Thumb", 150, 54, 12, 12, { fill: C.line2, radius: 6 });

    await client.text(timeCard.id, "Chart Title", 16, 80, "사당 · 2호선 · 강남 방면", {
      size: 12,
      weight: 600,
      color: C.slate700,
    });

    const chart = await client.frame(timeCard.id, "Chart Area", 16, 100, 326, 160, {
      fill: C.muted,
      radius: 8,
    });
    if (chart?.id) {
      const bars = [45, 62, 88, 95, 72, 58, 50, 42];
      const colors = [C.crowd.RELAXED, C.crowd.NORMAL, C.crowd.BUSY, C.crowd.VERY_BUSY, C.crowd.BUSY, C.crowd.NORMAL, C.crowd.RELAXED, C.crowd.RELAXED];
      for (let i = 0; i < bars.length; i++) {
        const bh = (bars[i] / 100) * 120;
        await client.rect(chart.id, `Bar ${i}`, 12 + i * 38, 140 - bh, 28, bh, {
          fill: colors[i],
          radius: 4,
        });
      }
      await client.text(chart.id, "Y Label", 4, 4, "혼잡도", { size: 9, color: C.mutedFg });
    }
  }

  await client.text(pid, "Routes Title", 16, 372, "추천 경로", { size: 13, weight: 600, color: C.slate600 });

  const route1 = await client.frame(pid, "Route Card 1", 16, 396, 358, 100, {
    fill: C.bg,
    radius: 12,
    stroke: C.border,
    strokeWeight: 1,
  });
  if (route1?.id) {
    await client.text(route1.id, "Name", 16, 12, "최단 시간", { size: 14, weight: 600, color: C.slate800 });
    await client.rect(route1.id, "Badge", 88, 10, 56, 20, { fill: C.muted, radius: 6 });
    await client.text(route1.id, "Badge Text", 94, 14, "시간 우선", { size: 9, color: C.slate700 });
    await client.text(route1.id, "Meta", 16, 38, "⏱ 32분  💰 1,400원  2호선 · 환승 0회", {
      size: 12,
      color: C.slate600,
    });
    await client.text(route1.id, "Crowd", 16, 62, "혼잡도 주의 (최대 128%)", { size: 12, color: C.mutedFg });
  }

  const route2 = await client.frame(pid, "Route Card 2", 16, 508, 358, 110, {
    fill: C.bg,
    radius: 12,
    stroke: C.line2,
    strokeWeight: 2,
  });
  if (route2?.id) {
    await client.text(route2.id, "Name", 16, 12, "쾌적 우선", { size: 14, weight: 600, color: C.slate800 });
    await client.rect(route2.id, "Badge", 88, 10, 56, 20, { fill: C.muted, radius: 6 });
    await client.text(route2.id, "Badge Text", 94, 14, "쾌적 우선", { size: 9, color: C.slate700 });
    await client.rect(route2.id, "Rec Badge", 270, 10, 36, 20, { fill: C.green50, radius: 6 });
    await client.text(route2.id, "Rec Text", 276, 14, "추천", { size: 9, color: C.green600, weight: 600 });
    await client.text(route2.id, "Meta", 16, 38, "⏱ 39분 (+7분)  💰 1,400원  9호선 우회 · 환승 1회", {
      size: 12,
      color: C.slate600,
    });
    await client.text(route2.id, "Crowd", 16, 62, "혼잡도 여유 (최대 72%)", { size: 12, color: C.mutedFg });
  }

  const nav = await buildBottomNav(client, pid, "route");
  return { header, timeCard, route1, route2, nav };
}

async function buildDetail(client) {
  const pid = FRAMES.detail;
  console.log("\n📱 03 상세");

  const header = await client.frame(pid, "Header", 16, 16, 358, 52);
  if (header?.id) {
    await client.text(header.id, "Back", 0, 8, "←", { size: 20, color: C.slate600 });
    await client.text(header.id, "Title", 36, 4, "경로 상세", { size: 15, weight: 600, color: C.slate800 });
    await client.text(header.id, "Sub", 36, 26, "신도림 → 신림 → 사당 → 강남", { size: 10, color: C.mutedFg });
  }

  const heatmap = await client.frame(pid, "Heatmap Card", 16, 80, 358, 420, {
    fill: C.bg,
    radius: 12,
    stroke: C.border,
    strokeWeight: 1,
  });
  if (heatmap?.id) {
    await client.text(heatmap.id, "Legend", 16, 12, "칸별 혼잡도 (출발 18:30)", { size: 11, weight: 600, color: C.slate700 });
    const stations = ["신도림", "신림", "사당", "강남"];
    const rows = [
      [C.crowd.RELAXED, C.crowd.RELAXED, C.crowd.NORMAL, C.crowd.NORMAL],
      [C.crowd.RELAXED, C.crowd.NORMAL, C.crowd.BUSY, C.crowd.BUSY],
      [C.crowd.NORMAL, C.crowd.BUSY, C.crowd.VERY_BUSY, C.crowd.BUSY],
      [C.crowd.NORMAL, C.crowd.NORMAL, C.crowd.BUSY, C.crowd.NORMAL],
      [C.crowd.RELAXED, C.crowd.NORMAL, C.crowd.BUSY, C.crowd.NORMAL],
      [C.crowd.RELAXED, C.crowd.RELAXED, C.crowd.NORMAL, C.crowd.RELAXED],
    ];
    for (let s = 0; s < stations.length; s++) {
      await client.text(heatmap.id, `Station ${stations[s]}`, 16, 40 + s * 88, stations[s], {
        size: 12,
        weight: 600,
        color: C.slate800,
      });
      for (let car = 0; car < 6; car++) {
        for (let seg = 0; seg < 4; seg++) {
          await client.rect(
            heatmap.id,
            `Cell ${stations[s]} ${car}-${seg}`,
            80 + seg * 64,
            36 + s * 88 + car * 12,
            58,
            10,
            { fill: rows[car][seg], radius: 2 },
          );
        }
      }
    }
    const legendY = 390;
    const legendItems = [
      ["여유", C.crowd.RELAXED],
      ["보통", C.crowd.NORMAL],
      ["주의", C.crowd.BUSY],
      ["혼잡", C.crowd.VERY_BUSY],
    ];
    for (let i = 0; i < legendItems.length; i++) {
      const [label, color] = legendItems[i];
      await client.rect(heatmap.id, `Leg ${label}`, 16 + i * 80, legendY, 12, 12, { fill: color, radius: 2 });
      await client.text(heatmap.id, `LegT ${label}`, 32 + i * 80, legendY, label, { size: 9, color: C.mutedFg });
    }
  }

  const tip = await client.frame(pid, "Alt Tip Card", 16, 516, 358, 90, {
    fill: C.muted,
    radius: 12,
  });
  if (tip?.id) {
    await client.text(tip.id, "Tip Label", 16, 12, "대안 안내", { size: 10, color: C.mutedFg, weight: 500 });
    await client.text(
      tip.id,
      "Tip Body",
      16,
      32,
      "사당역에서 하차 후 4분 뒤 다음 열차를 이용하면\n혼잡도가 약 40% 감소합니다.",
      { size: 12, color: C.slate700 },
    );
  }

  const nav = await buildBottomNav(client, pid, "detail");
  return { header, heatmap, tip, nav };
}

async function buildMap(client) {
  const pid = FRAMES.map;
  console.log("\n📱 04 노선도");

  await client.text(pid, "Title", 16, 16, "수도권 전철 노선도", { size: 17, weight: 700, color: C.fg });
  await client.text(pid, "Subtitle", 16, 40, "역을 클릭해 출발·도착을 지정하세요", { size: 10, color: C.mutedFg });

  const depPill = await client.frame(pid, "Departure Pill", 16, 64, 175, 52, {
    fill: C.green50,
    radius: 12,
    stroke: C.green600,
    strokeWeight: 2,
  });
  if (depPill?.id) {
    await client.text(depPill.id, "Dep Label", 12, 8, "출발", { size: 9, color: C.green600 });
    await client.text(depPill.id, "Dep Value", 12, 24, "신도림역", { size: 13, weight: 600, color: C.green800 });
  }

  const arrPill = await client.frame(pid, "Destination Pill", 199, 64, 175, 52, {
    fill: C.muted,
    radius: 12,
    stroke: C.border,
    strokeWeight: 1,
  });
  if (arrPill?.id) {
    await client.text(arrPill.id, "Arr Label", 12, 8, "도착", { size: 9, color: C.mutedFg });
    await client.text(arrPill.id, "Arr Value", 12, 24, "강남역", { size: 13, weight: 600, color: C.slate600 });
  }

  const timeBar = await client.frame(pid, "Time Chips", 16, 128, 358, 36, { fill: C.muted, radius: 12 });
  if (timeBar?.id) {
    const times = ["17:30", "18:00", "18:30", "19:00", "19:30"];
    for (let i = 0; i < times.length; i++) {
      const active = times[i] === "18:30";
      if (active) {
        await client.rect(timeBar.id, `Chip ${times[i]}`, 4 + i * 70, 4, 66, 28, { fill: C.bg, radius: 8 });
      }
      await client.text(timeBar.id, `Time ${times[i]}`, 18 + i * 70, 12, times[i], {
        size: 11,
        weight: active ? 600 : 400,
        color: active ? C.slate800 : C.mutedFg,
      });
    }
  }

  const mapArea = await client.frame(pid, "Metro Schematic", 16, 176, 358, 480, {
    fill: "#fafbfc",
    radius: 12,
    stroke: C.border,
    strokeWeight: 1,
  });
  if (mapArea?.id) {
    const legend = [
      ["1호선", C.line1],
      ["2호선", C.line2],
      ["9호선", C.line9],
    ];
    for (let i = 0; i < legend.length; i++) {
      await client.rect(mapArea.id, `Leg ${legend[i][0]}`, 16 + i * 72, 12, 28, 8, { fill: legend[i][1], radius: 4 });
      await client.text(mapArea.id, `LegT ${legend[i][0]}`, 48 + i * 72, 10, legend[i][0], { size: 8, color: C.mutedFg });
    }

    // Simplified 2호선 loop (ellipse approximation with rects)
    await client.rect(mapArea.id, "Line2 Top", 60, 80, 240, 6, { fill: C.line2, radius: 3 });
    await client.rect(mapArea.id, "Line2 Right", 294, 80, 6, 200, { fill: C.line2, radius: 3 });
    await client.rect(mapArea.id, "Line2 Bottom", 60, 274, 240, 6, { fill: C.line2, radius: 3 });
    await client.rect(mapArea.id, "Line2 Left", 54, 80, 6, 200, { fill: C.line2, radius: 3 });

    // Key stations
    const stations = [
      { name: "신도림", x: 40, y: 72, transfer: true },
      { name: "사당", x: 170, y: 268, transfer: true },
      { name: "강남", x: 290, y: 170, transfer: true },
      { name: "잠실", x: 290, y: 72, transfer: false },
      { name: "홍대", x: 54, y: 170, transfer: false },
    ];
    for (const st of stations) {
      const r = st.transfer ? 8 : 5;
      await client.rect(mapArea.id, `St ${st.name}`, st.x, st.y, r * 2, r * 2, {
        fill: C.bg,
        stroke: st.transfer ? "#1a1a1a" : C.line2,
        strokeWeight: st.transfer ? 2 : 1.5,
        radius: r,
      });
      await client.text(mapArea.id, `StL ${st.name}`, st.x - 8, st.y + r * 2 + 4, st.name, {
        size: 9,
        weight: 600,
        color: C.slate800,
      });
    }

    // Highlight route path
    await client.rect(mapArea.id, "Route Highlight", 58, 82, 4, 190, { fill: C.crowd.BUSY, radius: 2 });
    await client.text(mapArea.id, "Route Label", 100, 420, "신도림 → 강남 (2호선 직통)", {
      size: 10,
      color: C.mutedFg,
    });
  }

  const btn = await client.rect(pid, "Search Button", 16, 668, 358, 44, { fill: C.primary, radius: 12 });
  if (btn?.id) {
    await client.text(pid, "Search Btn Text", 131, 680, "경로 예측 검색", { size: 14, weight: 600, color: "#ffffff" });
  }

  await client.text(pid, "Footer", 16, 720, "혼잡도 시뮬레이션 18:30 · 갱신됨", { size: 9, color: C.slate400 });

  const nav = await buildBottomNav(client, pid, "map");
  return { depPill, arrPill, timeBar, mapArea, nav };
}

async function probePlugin(client) {
  console.log("Probing Figma plugin connection...");
  const result = await client.cmd("get_document_info", {});
  if (!result) {
    throw new Error(
      "Figma plugin not responding. Open Figma → Plugins → Cursor Talk to Figma MCP → join channel " +
        CHANNEL,
    );
  }
  console.log("Plugin connected:", result.name ?? "ok");
}

async function fixColors(client, failures) {
  console.log(`\n🎨 Applying ${failures.length} missed colors...`);
  let ok = 0;
  for (const f of failures) {
    const { command, params } = f;
    const { nodeId, r, g, b, a, weight } = params;
    const color = { r, g, b, a: a ?? 1 };
    const result =
      command === "set_fill_color"
        ? await client.cmd("set_fill_color", { nodeId, color })
        : command === "set_stroke_color"
          ? await client.cmd("set_stroke_color", { nodeId, color, weight: weight ?? 1 })
          : null;
    if (result) ok++;
    await new Promise((r) => setTimeout(r, 50));
  }
  console.log(`Applied ${ok}/${failures.length} colors`);
}

async function main() {
  const client = new FigmaClient();
  console.log("Connecting to Figma relay...");
  await client.connect();
  await client.join();
  console.log(`Joined channel: ${CHANNEL}`);
  await probePlugin(client);

  console.log("\n🗑 Deleting placeholders...");
  for (const id of PLACEHOLDERS) {
    await client.deleteNode(id);
    await new Promise((r) => setTimeout(r, 200));
  }

  const results = {
    home: await buildHome(client),
    route: await buildRoute(client),
    detail: await buildDetail(client),
    map: await buildMap(client),
  };

  const summary = {
    channel: CHANNEL,
    created: client.created.length,
    failures: client.failures.length,
    failureDetails: client.failures,
    nodeIds: Object.fromEntries(
      Object.entries(results).map(([k, v]) => [
        k,
        Object.fromEntries(
          Object.entries(v)
            .filter(([, val]) => val?.id)
            .map(([name, val]) => [name, val.id]),
        ),
      ]),
    ),
  };

  console.log("\n✅ Done");
  console.log(JSON.stringify(summary, null, 2));
  client.ws.close();
}

async function runFixColors() {
  const path = process.argv[process.argv.indexOf("--fix-colors") + 1];
  if (!path) {
    console.error("Usage: bun scripts/build-figma-ui.mjs --fix-colors <failures-json-path>");
    process.exit(1);
  }
  const raw = await Bun.file(path).text();
  const match = raw.match(/\{\s*"channel"[\s\S]*\}\s*$/);
  if (!match) throw new Error("Could not find summary JSON in file");
  const json = JSON.parse(match[0]);
  const failures = json.failureDetails ?? json;
  const client = new FigmaClient();
  await client.connect();
  await client.join();
  await probePlugin(client);
  await fixColors(client, failures);
  client.ws.close();
}

if (process.argv.includes("--fix-colors")) {
  runFixColors().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
} else {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
