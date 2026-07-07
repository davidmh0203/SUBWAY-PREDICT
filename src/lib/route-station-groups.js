function isKeyStation(type) {
  return type === "departure" || type === "arrival" || type === "transfer";
}

/** @returns {{ flat: Array, groups: Array<{ id, waypointNames, beforeKey, afterKey }> }} */
export function buildRouteStationGroups(segments) {
  if (!segments?.length) return { flat: [], groups: [] };

  const flat = [];
  for (const seg of segments) {
    for (const st of seg.stations) {
      flat.push({
        ...st,
        lineColor: seg.lineColor,
        lineName: seg.lineName,
      });
    }
  }

  const groups = [];
  let waypointRun = [];
  let beforeKey = flat.find((s) => isKeyStation(s.type))?.name ?? flat[0]?.name;

  const flush = (afterKey) => {
    if (waypointRun.length > 0) {
      groups.push({
        id: `group-${groups.length}`,
        waypointNames: waypointRun.map((w) => w.name),
        beforeKey,
        afterKey,
      });
      waypointRun = [];
    }
    if (afterKey) beforeKey = afterKey;
  };

  for (const st of flat) {
    if (isKeyStation(st.type)) {
      flush(st.name);
    } else {
      waypointRun.push(st);
    }
  }

  const lastKey = [...flat].reverse().find((s) => isKeyStation(s.type))?.name;
  if (waypointRun.length > 0) {
    groups.push({
      id: `group-${groups.length}`,
      waypointNames: waypointRun.map((w) => w.name),
      beforeKey,
      afterKey: lastKey ?? beforeKey,
    });
  }

  return { flat, groups };
}

export function isStationVisible(st, groups, expandedGroups) {
  if (isKeyStation(st.type)) return true;
  const group = groups.find((g) => g.waypointNames.includes(st.name));
  if (!group) return true;
  return expandedGroups.has(group.id);
}

function buildRenderItems(flat, groups, expandedGroups) {
  const items = [];
  let i = 0;

  while (i < flat.length) {
    const st = flat[i];
    if (isKeyStation(st.type)) {
      items.push({ type: "station", station: st });
      i++;
      continue;
    }

    const group = groups.find((g) => g.waypointNames[0] === st.name);
    if (!group) {
      items.push({ type: "station", station: st });
      i++;
      continue;
    }

    if (expandedGroups?.has(group.id)) {
      for (const name of group.waypointNames) {
        const station = flat.find((s) => s.name === name);
        if (station) items.push({ type: "station", station });
      }
    } else {
      items.push({ type: "collapse", group });
    }
    i += group.waypointNames.length;
  }

  return items;
}

export { buildRenderItems, isKeyStation };
