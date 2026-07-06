import {
  LINE_COLOR_LABELS,
  METRO_LINE_SEGMENTS,
  type MetroLineSegment,
} from "./metro-network";

export interface LineEndBadge {
  id: string;
  x: number;
  y: number;
  color: string;
  lineKey: string;
  label: string;
}

/** 인접 세그먼트 끝점을 같은 역으로 묶는 허용 거리 */
const NODE_MERGE_TOL = 8;
/** 최소 세그먼트 수 (이보다 짧은 조각은 배지 없음) */
const MIN_COMPONENT_SEGS = 3;
/** 주요 분기 포함: 최대 컴포넌트 대비 최소 비율 */
const BRANCH_SEG_RATIO = 0.2;

function colorToLineKey(color: string): string {
  return LINE_COLOR_LABELS[color.toLowerCase()] ?? color.toLowerCase();
}

/** "1호선" → "1", "신분당선" → "신" */
export function lineKeyToBadgeLabel(lineKey: string): string {
  const num = lineKey.match(/^(\d+)호선/);
  if (num) return num[1];

  const shorts: Record<string, string> = {
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
    서해선: "서해",
  };
  return shorts[lineKey] ?? lineKey.replace(/선$/, "").slice(0, 3);
}

class UnionFind {
  parent: number[];

  constructor(size: number) {
    this.parent = [...Array(size).keys()];
  }

  find(index: number): number {
    return this.parent[index] === index
      ? index
      : (this.parent[index] = this.find(this.parent[index]));
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent[rootB] = rootA;
  }
}

interface GraphNode {
  x: number;
  y: number;
  neighbors: Set<number>;
}

interface LineComponent {
  segCount: number;
  nodeIds: number[];
}

function farthestLeafPair(
  leaves: { id: number; x: number; y: number }[],
): { id: number; x: number; y: number }[] {
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

function outwardDirection(
  nodeId: number,
  nodes: Map<number, GraphNode>,
): { dirX: number; dirY: number } {
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

function buildLineGraph(segs: MetroLineSegment[]): {
  nodes: Map<number, GraphNode>;
  components: LineComponent[];
} {
  const points: { x: number; y: number }[] = [];
  const edges: [number, number][] = [];

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

  const nodes = new Map<number, GraphNode>();
  for (let i = 0; i < points.length; i++) {
    const id = uf.find(i);
    let node = nodes.get(id);
    if (!node) {
      node = { x: 0, y: 0, neighbors: new Set() };
      nodes.set(id, node);
    }
    node.x += points[i].x;
    node.y += points[i].y;
  }

  const nodeCounts = new Map<number, number>();
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

  const visited = new Set<number>();
  const components: LineComponent[] = [];

  for (const startId of nodes.keys()) {
    if (visited.has(startId)) continue;

    const queue = [startId];
    const nodeIds: number[] = [];
    const edgeKeys = new Set<string>();
    visited.add(startId);

    while (queue.length > 0) {
      const current = queue.pop()!;
      nodeIds.push(current);

      for (const neighborId of nodes.get(current)?.neighbors ?? []) {
        edgeKeys.add(
          current < neighborId ? `${current}|${neighborId}` : `${neighborId}|${current}`,
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

function findTerminalsForSegments(
  segs: MetroLineSegment[],
): { x: number; y: number; dirX: number; dirY: number }[] {
  if (segs.length < MIN_COMPONENT_SEGS) return [];

  const { nodes, components } = buildLineGraph(segs);
  if (components.length === 0) return [];

  components.sort((a, b) => b.segCount - a.segCount);
  const maxSegCount = components[0]?.segCount ?? 0;
  const branchThreshold = Math.max(MIN_COMPONENT_SEGS, maxSegCount * BRANCH_SEG_RATIO);

  const terminals: { x: number; y: number; dirX: number; dirY: number }[] = [];

  for (const comp of components) {
    if (comp.segCount < MIN_COMPONENT_SEGS) continue;
    if (comp.segCount < branchThreshold && comp.segCount < maxSegCount) continue;

    const leaves = comp.nodeIds
      .filter((id) => (nodes.get(id)?.neighbors.size ?? 0) === 1)
      .map((id) => {
        const node = nodes.get(id)!;
        return { id, x: node.x, y: node.y };
      });

    // 완전 순환 노선(2호선 등): 끝점 없음
    if (leaves.length === 0) continue;

    // 거의 순환인데 데이터가 한 곳 끊긴 경우
    if (leaves.length === 1 && comp.segCount >= 6) continue;

    const picked = farthestLeafPair(leaves);
    for (const leaf of picked) {
      const { dirX, dirY } = outwardDirection(leaf.id, nodes);
      terminals.push({ x: leaf.x, y: leaf.y, dirX, dirY });
    }
  }

  return terminals;
}

export function computeLineEndBadges(): LineEndBadge[] {
  const groups = new Map<string, { color: string; segs: MetroLineSegment[] }>();

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

  const badges: LineEndBadge[] = [];
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
        color,
        lineKey,
        label,
      });
    }
  }

  return badges;
}

export const LINE_END_BADGES = computeLineEndBadges();
