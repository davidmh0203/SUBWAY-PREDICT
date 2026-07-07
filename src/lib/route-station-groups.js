function isKeyStation(type) {
  return type === "departure" || type === "arrival" || type === "transfer";
}

/** @returns {Array<{ id, lineName, lineColor, boarding, waypoints, alighting, isLast }>} */
export function buildRidingLegs(segments) {
  if (!segments?.length) return [];

  return segments.map((seg, i) => {
    const isLastLeg = i === segments.length - 1;
    const boarding = {
      ...seg.stations[0],
      lineColor: seg.lineColor,
      lineName: seg.lineName,
    };

    let alighting;
    let waypoints;

    if (isLastLeg) {
      alighting = {
        ...seg.stations[seg.stations.length - 1],
        lineColor: seg.lineColor,
        lineName: seg.lineName,
      };
      waypoints = seg.stations.slice(1, -1).map((st) => ({
        ...st,
        lineColor: seg.lineColor,
        lineName: seg.lineName,
      }));
    } else {
      const nextSeg = segments[i + 1];
      alighting = {
        ...nextSeg.stations[0],
        type: "transfer",
        lineColor: seg.lineColor,
        lineName: seg.lineName,
      };
      waypoints = seg.stations.slice(1).map((st) => ({
        ...st,
        lineColor: seg.lineColor,
        lineName: seg.lineName,
      }));
    }

    return {
      id: `leg-${i}`,
      lineName: seg.lineName,
      lineColor: seg.lineColor,
      boarding,
      waypoints,
      alighting,
      isLast: isLastLeg,
    };
  });
}

export function isWaypointVisible(stationName, legs, expandedGroups) {
  for (const leg of legs) {
    if (leg.waypoints.some((w) => w.name === stationName)) {
      return expandedGroups?.has(leg.id) ?? false;
    }
  }
  return true;
}

/** @deprecated use buildRidingLegs */
export function buildRouteStationGroups(segments) {
  const legs = buildRidingLegs(segments);
  const flat = [];
  for (const seg of segments ?? []) {
    for (const st of seg.stations) {
      flat.push({ ...st, lineColor: seg.lineColor, lineName: seg.lineName });
    }
  }
  const groups = legs.map((leg) => ({
    id: leg.id,
    waypointNames: leg.waypoints.map((w) => w.name),
    beforeKey: leg.boarding.name,
    afterKey: leg.alighting.name,
  }));
  return { flat, groups, legs };
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
