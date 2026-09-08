#!/usr/bin/env node
/**
 * 여유로 아키텍처 Excalidraw 파일 생성
 * docs/assets/yeoyuro-architecture.excalidraw
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../docs/assets/yeoyuro-architecture.excalidraw");

let _seed = 1;
const id = () => `el-${(_seed++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nonce = () => Math.floor(Math.random() * 2 ** 31);

function rect(x, y, w, h, opts = {}) {
  const elId = id();
  return {
    el: {
      id: elId,
      type: "rectangle",
      x,
      y,
      width: w,
      height: h,
      angle: 0,
      strokeColor: opts.stroke ?? "#1e1e1e",
      backgroundColor: opts.bg ?? "#ffffff",
      fillStyle: "solid",
      strokeWidth: opts.strokeWidth ?? 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: opts.groupIds ?? [],
      frameId: null,
      index: opts.index ?? "a0",
      roundness: { type: 3 },
      seed: nonce(),
      version: 1,
      versionNonce: nonce(),
      isDeleted: false,
      boundElements: [],
      updated: Date.now(),
      link: null,
      locked: false,
    },
    id: elId,
  };
}

function label(x, y, text, opts = {}) {
  const elId = id();
  return {
    el: {
      id: elId,
      type: "text",
      x,
      y,
      width: opts.width ?? text.length * 10,
      height: opts.height ?? 25,
      angle: 0,
      strokeColor: opts.color ?? "#1e1e1e",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: opts.groupIds ?? [],
      frameId: null,
      index: opts.index ?? "a1",
      roundness: null,
      seed: nonce(),
      version: 1,
      versionNonce: nonce(),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      fontSize: opts.fontSize ?? 16,
      fontFamily: 1,
      text,
      textAlign: opts.align ?? "left",
      verticalAlign: "top",
      containerId: null,
      originalText: text,
      autoResize: true,
      lineHeight: 1.25,
    },
    id: elId,
  };
}

function arrow(x, y, dx, dy, startId, endId, opts = {}) {
  const elId = id();
  const pts = [
    [0, 0],
    [dx, dy],
  ];
  return {
    el: {
      id: elId,
      type: "arrow",
      x,
      y,
      width: Math.abs(dx),
      height: Math.abs(dy),
      angle: 0,
      strokeColor: opts.color ?? "#64748b",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      index: "a2",
      roundness: { type: 2 },
      seed: nonce(),
      version: 1,
      versionNonce: nonce(),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      points: pts,
      lastCommittedPoint: null,
      startBinding: startId
        ? { elementId: startId, focus: opts.startFocus ?? 0, gap: 4 }
        : null,
      endBinding: endId
        ? { elementId: endId, focus: opts.endFocus ?? 0, gap: 4 }
        : null,
      startArrowhead: null,
      endArrowhead: "arrow",
      elbowed: false,
    },
    id: elId,
  };
}

function dashedGroup(x, y, w, h, title) {
  const gid = id();
  const g = [];
  const box = rect(x, y, w, h, {
    stroke: "#94a3b8",
    bg: "#f8fafc",
    strokeWidth: 1,
    groupIds: [gid],
  });
  box.el.strokeStyle = "dashed";
  g.push(box.el);
  const t = label(x + 12, y - 22, title, { fontSize: 14, color: "#475569" });
  g.push(t.el);
  return { elements: g, id: box.id };
}

const elements = [];
const bindings = [];

// Title
elements.push(
  label(40, 20, "여유로 — 서비스 아키텍처", { fontSize: 28, color: "#0f172a" }).el,
);
elements.push(
  label(
    40,
    56,
    "2026-07-22 · GitHub main · Supabase = PostgreSQL · 모델 학습 제외",
    { fontSize: 14, color: "#64748b" },
  ).el,
);

// User
const user = rect(480, 100, 120, 70, { bg: "#f1f5f9", stroke: "#94a3b8" });
elements.push(user.el);
elements.push(label(510, 118, "👤 사용자", { fontSize: 16, align: "center" }).el);
elements.push(label(495, 142, "모바일 브라우저", { fontSize: 12, color: "#64748b" }).el);

// Vercel group
const vercelG = dashedGroup(380, 220, 340, 130, "Vercel · GitHub Actions");
const react = rect(400, 260, 140, 70, { bg: "#f0fbff", stroke: "#61dafb", groupIds: vercelG.elements[0]?.groupIds });
react.el.x = 400;
react.el.y = 260;
elements.push(...vercelG.elements);
elements.push(react.el);
elements.push(label(418, 278, "⚛ React 19 SPA", { fontSize: 15 }).el);
elements.push(label(408, 300, "Vite · Tailwind", { fontSize: 11, color: "#64748b" }).el);

const vercel = rect(560, 260, 140, 70, { bg: "#ffffff", stroke: "#000000" });
elements.push(vercel.el);
elements.push(label(590, 278, "▲ Vercel CDN", { fontSize: 15 }).el);
elements.push(
  label(565, 300, "subway-predict-dashboard", { fontSize: 9, color: "#64748b" }).el,
);

// Supabase group
const sbG = dashedGroup(40, 400, 320, 200, "Supabase (팀 공용 · PostgreSQL)");
const sbAuth = rect(60, 450, 120, 80, { bg: "#f0fdf4", stroke: "#3ecf8e" });
elements.push(...sbG.elements);
elements.push(sbAuth.el);
elements.push(label(72, 472, "Supabase Auth", { fontSize: 14 }).el);
elements.push(label(68, 494, "Email · Kakao OAuth", { fontSize: 10, color: "#64748b" }).el);

const pg = rect(220, 450, 120, 80, { bg: "#eff6ff", stroke: "#4169e1" });
elements.push(pg.el);
elements.push(label(235, 472, "PostgreSQL", { fontSize: 14 }).el);
elements.push(label(228, 494, "auth.users", { fontSize: 10, color: "#64748b" }).el);
elements.push(
  label(215, 508, "favorite_routes · RLS", { fontSize: 10, color: "#64748b" }).el,
);
elements.push(
  label(55, 545, "React → VITE_SUPABASE_* (회원·즐겨찾기)", {
    fontSize: 11,
    color: "#475569",
  }).el,
);

// Render / FastAPI group
const renderG = dashedGroup(400, 400, 340, 200, "Render · Docker (FastAPI)");
const render = rect(420, 450, 110, 80, { bg: "#ecfdf5", stroke: "#46e3b7" });
elements.push(...renderG.elements);
elements.push(render.el);
elements.push(label(445, 472, "Render", { fontSize: 14 }).el);
elements.push(label(430, 494, "render.yaml", { fontSize: 10, color: "#64748b" }).el);

const api = rect(560, 450, 160, 80, { bg: "#f0fdfa", stroke: "#009688" });
elements.push(api.el);
elements.push(label(575, 468, "FastAPI", { fontSize: 14 }).el);
elements.push(label(568, 488, "/predict/route · /forecast", { fontSize: 9, color: "#64748b" }).el);
elements.push(label(568, 502, "/odsay · LightGBM .pkl", { fontSize: 9, color: "#64748b" }).el);
elements.push(
  label(415, 545, "React → VITE_API_BASE_URL (경로·혼잡·예보)", {
    fontSize: 11,
    color: "#475569",
  }).el,
);

// Kakao Map
const kakaoG = dashedGroup(780, 400, 180, 120, "프론트 직연");
const kakao = rect(800, 440, 140, 60, { bg: "#fffbeb", stroke: "#fee500" });
elements.push(...kakaoG.elements);
elements.push(kakao.el);
elements.push(label(815, 458, "Kakao Map JS", { fontSize: 14 }).el);
elements.push(label(808, 478, "#macro 실측 지도", { fontSize: 10, color: "#64748b" }).el);

// External APIs
const extG = dashedGroup(40, 640, 920, 110, "외부 API · 데이터 (FastAPI 경유)");
const extBoxes = [
  { x: 60, title: "ODsay LAB", sub: "경로 탐색\nTTL 캐시" },
  { x: 220, title: "Kakao REST", sub: "/stations/nearby" },
  { x: 380, title: "공공데이터", sub: "특일 · 기상청" },
  { x: 540, title: "CSV", sub: "ntce · SPATIC" },
  { x: 700, title: ".pkl", sub: "backend/models" },
];
elements.push(...extG.elements);
for (const b of extBoxes) {
  const r = rect(b.x, 680, 130, 55, { bg: "#fafafa", stroke: "#cbd5e1" });
  elements.push(r.el);
  elements.push(label(b.x + 10, 692, b.title, { fontSize: 13 }).el);
  elements.push(
    label(b.x + 10, 712, b.sub, { fontSize: 9, color: "#64748b" }).el,
  );
}

// CI/CD row
const gh = rect(180, 800, 150, 65, { bg: "#f6f8fa", stroke: "#24292f" });
elements.push(gh.el);
elements.push(label(210, 818, "GitHub", { fontSize: 14 }).el);
elements.push(label(195, 838, "SUBWAY-PREDICT", { fontSize: 9, color: "#64748b" }).el);

const gha = rect(420, 800, 180, 65, { bg: "#f6f8fa", stroke: "#2088ff" });
elements.push(gha.el);
elements.push(label(440, 818, "GitHub Actions", { fontSize: 14 }).el);
elements.push(label(435, 838, "deploy.yml → Vercel", { fontSize: 9, color: "#64748b" }).el);

const vercelDeploy = rect(680, 800, 150, 65, { bg: "#ffffff", stroke: "#000" });
elements.push(vercelDeploy.el);
elements.push(label(710, 818, "Vercel 배포", { fontSize: 14 }).el);

// Arrows
const arrows = [
  arrow(540, 170, 0, 50, user.id, react.id),
  arrow(470, 330, -200, 110, react.id, sbAuth.id, { startFocus: -0.5, endFocus: 0 }),
  arrow(540, 330, 0, 110, react.id, render.id),
  arrow(540, 330, 280, 100, react.id, kakao.id, { startFocus: 0.5 }),
  arrow(180, 490, 30, 0, sbAuth.id, pg.id),
  arrow(530, 490, 20, 0, render.id, api.id),
  arrow(640, 530, 0, 140, api.id, null),
  arrow(330, 330, 0, 0, null, null), // placeholder skip
  arrow(330, 830, 80, 0, gh.id, gha.id),
  arrow(600, 830, 70, 0, gha.id, vercelDeploy.id),
];
for (const a of arrows) {
  if (a.el.startBinding || a.el.endBinding || (!a.el.startBinding && !a.el.endBinding && a !== arrows[7])) {
    elements.push(a.el);
  }
}

// Legend
elements.push(
  label(
    40,
    890,
    "DB: Supabase = 관리형 PostgreSQL (별도 RDB 선택 없음). SQLite는 Supabase env 없을 때 FastAPI fallback만.",
    { fontSize: 12, color: "#64748b", width: 900 },
  ).el,
);

const scene = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements,
  appState: {
    gridSize: 20,
    viewBackgroundColor: "#ffffff",
  },
  files: {},
};

writeFileSync(OUT, JSON.stringify(scene, null, 2), "utf8");
console.log(`Wrote ${OUT} (${elements.length} elements)`);
