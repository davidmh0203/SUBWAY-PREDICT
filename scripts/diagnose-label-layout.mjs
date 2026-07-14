/**
 * Misplaced labels: label closer to another station's node than its own.
 * Run: node scripts/diagnose-label-layout.mjs
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const stations = JSON.parse(
  readFileSync(path.join(root, "src/lib/generated/metro-stations.json"), "utf8"),
);

const { getLabelLayout } = await import(
  pathToFileURL(path.join(root, "src/lib/metro-label-layout.js")).href
);

const mismatches = [];
for (const station of stations) {
  if (station.name.startsWith("(")) continue;
  const lbl = getLabelLayout(station.id);
  const ownDist = Math.hypot(lbl.x - station.x, lbl.y - station.y);
  let nearestOther = null;
  let nearestOtherDist = Infinity;
  for (const other of stations) {
    if (other.id === station.id) continue;
    const d = Math.hypot(lbl.x - other.x, lbl.y - other.y);
    if (d < nearestOtherDist) {
      nearestOtherDist = d;
      nearestOther = other;
    }
  }
  if (nearestOther && nearestOtherDist + 1 < ownDist) {
    mismatches.push({
      name: station.name,
      ownDist: ownDist.toFixed(1),
      closerTo: nearestOther.name,
      closerDist: nearestOtherDist.toFixed(1),
    });
  }
}

mismatches.sort((a, b) => Number(a.closerDist) - Number(b.closerDist));
console.log(`Misplaced labels: ${mismatches.length}`);
for (const row of mismatches.slice(0, 20)) {
  console.log(`  ${row.name} → closer to ${row.closerTo} (${row.closerDist} vs own ${row.ownDist})`);
}

const pair = ["구의", "아차산"];
for (const name of pair) {
  const s = stations.find((x) => x.name === name);
  const lbl = getLabelLayout(s.id);
  console.log(`${name} node (${s.x},${s.y}) label (${lbl.x.toFixed(1)},${lbl.y.toFixed(1)})`);
}
