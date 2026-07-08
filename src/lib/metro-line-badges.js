import {
  LINE_COLOR_LABELS,
  METRO_LINE_SEGMENTS,
  normalizeLineColor,
} from "./metro-network";
const NODE_MERGE_TOL = 8;
const MIN_COMPONENT_SEGS = 3;
const BRANCH_SEG_RATIO = 0.2;
function colorToLineKey(color) {
  return LINE_COLOR_LABELS[color.toLowerCase()] ?? color.toLowerCase();
}
function lineKeyToBadgeLabel(lineKey) {
  const num = lineKey.match(/^(\d+)호선/);
  if (num) return num[1];
  const shorts = {
    "2호선(성수지선)": "2",
    신분당선: "신",
    경의중앙: "경의",
    경춘선: "경춘",
    공항철도: "공항",
    경강선: "경강",
    우이신설: "우이",
    경의선: "경의",
    인천1: "인천1",
    인천2: "인천2",
    인천공항: "AREX",
    김포골드: "G",
    수인분당: "분당",
    분당선: "분당",
    서해선: "서해",
    "GTX-A": "GTX",
  };
  return shorts[lineKey] ?? lineKey.replace(/선$/, "").slice(0, 3);
}
class UnionFind {
  parent;
  constructor(size) {
    this.parent = [...Array(size).keys()];
  }
  find(index) {
    return this.parent[index] === index ? index : this.parent[index] = this.find(this.parent[index]);
  }
  union(a, b) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent[rootB] = rootA;
  }
}
function farthestLeafPair(leaves) {
  if (leaves.length <= 2) return leaves;
  let bestI = 0;
  let bestJ = 1;
  let bestDist = 0;
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const dist = Math.hypot(leaves[i].x - leaves[j].x, leaves[i].y - leaves[j].y);
      if (dist > bestDist) {
        bestDist = dist;
        bestI = i;
        bestJ = j;
      }
    }
  }
  return [leaves[bestI], leaves[bestJ]];
}
function outwardDirection(nodeId, nodes) {
  const node = nodes.get(nodeId);
  if (!node || node.neighbors.size === 0) return { dirX: 1, dirY: 0 };
  let ix = 0;
  let iy = 0;
  for (const neighborId of node.neighbors) {
    const neighbor = nodes.get(neighborId);
    if (!neighbor) continue;
    ix += node.x - neighbor.x;
    iy += node.y - neighbor.y;
  }
  const len = Math.hypot(ix, iy) || 1;
  return { dirX: ix / len, dirY: iy / len };
}
function buildLineGraph(segs) {
  const points = [];
  const edges = [];
  for (const seg of segs) {
    const a = points.length;
    points.push({ x: seg.x1, y: seg.y1 });
    const b = points.length;
    points.push({ x: seg.x2, y: seg.y2 });
    edges.push([a, b]);
  }
  const uf = new UnionFind(points.length);
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) <= NODE_MERGE_TOL) {
        uf.union(i, j);
      }
    }
  }
  const nodes = /* @__PURE__ */ new Map();
  for (let i = 0; i < points.length; i++) {
    const id = uf.find(i);
    let node = nodes.get(id);
    if (!node) {
      node = { x: 0, y: 0, neighbors: /* @__PURE__ */ new Set() };
      nodes.set(id, node);
    }
    node.x += points[i].x;
    node.y += points[i].y;
  }
  const nodeCounts = /* @__PURE__ */ new Map();
  for (let i = 0; i < points.length; i++) {
    const id = uf.find(i);
    nodeCounts.set(id, (nodeCounts.get(id) ?? 0) + 1);
  }
  for (const [id, node] of nodes) {
    const count = nodeCounts.get(id) ?? 1;
    node.x /= count;
    node.y /= count;
  }
  for (const [a, b] of edges) {
    const nodeA = uf.find(a);
    const nodeB = uf.find(b);
    if (nodeA === nodeB) continue;
    nodes.get(nodeA)?.neighbors.add(nodeB);
    nodes.get(nodeB)?.neighbors.add(nodeA);
  }
  const visited = /* @__PURE__ */ new Set();
  const components = [];
  for (const startId of nodes.keys()) {
    if (visited.has(startId)) continue;
    const queue = [startId];
    const nodeIds = [];
    const edgeKeys = /* @__PURE__ */ new Set();
    visited.add(startId);
    while (queue.length > 0) {
      const current = queue.pop();
      nodeIds.push(current);
      for (const neighborId of nodes.get(current)?.neighbors ?? []) {
        edgeKeys.add(
          current < neighborId ? `${current}|${neighborId}` : `${neighborId}|${current}`
        );
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
    components.push({ segCount: edgeKeys.size, nodeIds });
  }
  return { nodes, components };
}
function findTerminalsForSegments(segs) {
  if (segs.length < MIN_COMPONENT_SEGS) return [];
  const { nodes, components } = buildLineGraph(segs);
  if (components.length === 0) return [];
  components.sort((a, b) => b.segCount - a.segCount);
  const maxSegCount = components[0]?.segCount ?? 0;
  const branchThreshold = Math.max(MIN_COMPONENT_SEGS, maxSegCount * BRANCH_SEG_RATIO);
  const terminals = [];
  for (const comp of components) {
    if (comp.segCount < MIN_COMPONENT_SEGS) continue;
    if (comp.segCount < branchThreshold && comp.segCount < maxSegCount) continue;
    const leaves = comp.nodeIds.filter((id) => (nodes.get(id)?.neighbors.size ?? 0) === 1).map((id) => {
      const node = nodes.get(id);
      return { id, x: node.x, y: node.y };
    });
    if (leaves.length === 0) continue;
    if (leaves.length === 1 && comp.segCount >= 6) continue;
    const picked = farthestLeafPair(leaves);
    for (const leaf of picked) {
      const { dirX, dirY } = outwardDirection(leaf.id, nodes);
      terminals.push({ x: leaf.x, y: leaf.y, dirX, dirY });
    }
  }
  return terminals;
}
function computeLineEndBadges() {
  const groups = /* @__PURE__ */ new Map();
  for (const seg of METRO_LINE_SEGMENTS) {
    const key = colorToLineKey(seg.color);
    const group = groups.get(key);
    if (group) {
      group.segs.push(seg);
      if (seg.color.toLowerCase() < group.color.toLowerCase()) group.color = seg.color;
    } else {
      groups.set(key, { color: seg.color, segs: [seg] });
    }
  }
  const badges = [];
  let idx = 0;
  for (const [lineKey, { color, segs }] of groups) {
    const endpoints = findTerminalsForSegments(segs);
    const label = lineKeyToBadgeLabel(lineKey);
    for (const pt of endpoints) {
      const br = label.length <= 2 ? 7 : label.length <= 4 ? 8.5 : 10;
      const offset = br + 3;
      badges.push({
        id: `badge-${idx++}`,
        x: pt.x + pt.dirX * offset,
        y: pt.y + pt.dirY * offset,
        color: normalizeLineColor(color),
        lineKey,
        label
      });
    }
  }
  return badges;
}
const LINE_END_BADGES = computeLineEndBadges();
export {
  LINE_END_BADGES,
  computeLineEndBadges,
  lineKeyToBadgeLabel
};
