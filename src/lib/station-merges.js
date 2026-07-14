/**
 * SVG에서 잘못 분리된 역을 실제 역명·노드로 통합합니다.
 */
export const STATION_MERGES = [
  {
    id: "가산디지털단지",
    name: "가산디지털단지",
    absorbIds: ["가산", "디지털단지"],
    aliases: ["가산", "디지털단지"],
    x: 590.92,
    y: 632.37,
  },
];

/** SVG 줄바꿈 등으로 짧게 추출된 역명 → 공식 역명 */
export const STATION_RENAMES = {
  아시아드: {
    id: "아시아드경기장",
    name: "아시아드경기장",
    aliases: ["아시아드"],
  },
};

const ABSORBED_IDS = new Set(STATION_MERGES.flatMap((m) => m.absorbIds));
const MERGE_BY_ABSORBED_ID = new Map(
  STATION_MERGES.flatMap((merge) => merge.absorbIds.map((id) => [id, merge])),
);
const ALIAS_TO_CANONICAL = new Map([
  ...STATION_MERGES.flatMap((merge) =>
    (merge.aliases ?? []).map((alias) => [alias, merge.name]),
  ),
  ...Object.values(STATION_RENAMES).flatMap((rename) =>
    (rename.aliases ?? []).map((alias) => [alias, rename.name]),
  ),
]);

export function applyStationMerges(stations) {
  const merged = [];
  const added = new Set();

  for (const station of stations) {
    const rule = MERGE_BY_ABSORBED_ID.get(station.id);
    if (rule) {
      if (!added.has(rule.id)) {
        merged.push({
          id: rule.id,
          name: rule.name,
          x: rule.x,
          y: rule.y,
        });
        added.add(rule.id);
      }
      continue;
    }
    if (ABSORBED_IDS.has(station.id)) continue;
    merged.push(station);
  }

  return applyStationRenames(
    merged.sort((a, b) => a.name.localeCompare(b.name, "ko")),
  );
}

function applyStationRenames(stations) {
  return stations.map((station) => {
    const rule = STATION_RENAMES[station.id];
    if (!rule) return station;
    return { ...station, id: rule.id, name: rule.name };
  });
}

export function migrateRenamedLabelPositions(labelPositions) {
  for (const [fromId, rule] of Object.entries(STATION_RENAMES)) {
    if (labelPositions[fromId] && !labelPositions[rule.id]) {
      labelPositions[rule.id] = labelPositions[fromId];
    }
    delete labelPositions[fromId];
  }
  return labelPositions;
}

export function resolveStationAlias(nameOrId) {
  const clean = String(nameOrId ?? "")
    .replace(/역.*$/, "")
    .trim();
  return ALIAS_TO_CANONICAL.get(clean) ?? clean;
}

export function isAbsorbedStationId(id) {
  return ABSORBED_IDS.has(id);
}
