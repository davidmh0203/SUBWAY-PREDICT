import { MOCK_WALK_TRANSFER_MINUTES } from "@/lib/route-timing";

function isKeyStation(type) {
  return type === "departure" || type === "arrival" || type === "transfer";
}

function isNoRideSegment(seg) {
  if (!seg?.stations?.length) return true;
  if (seg.stations.length < 2) return true;
  const first = seg.stations[0]?.name;
  const last = seg.stations[seg.stations.length - 1]?.name;
  return Boolean(first && last && first === last);
}

/**
 * 빈 열차 구간(승차=하차·1역만) 제거.
 * - 동일역: 그냥 삭제
 * - 마지막이 다른 역: 잘못된 호선 흡수 대신 walkAfter.destination 으로 도보 도착 처리
 */
export function pruneNoRideSegments(segments) {
  if (!segments?.length) return [];
  const out = segments.map((seg) => ({
    ...seg,
    stations: [...seg.stations],
    walkAfter: seg.walkAfter ? { ...seg.walkAfter } : undefined,
  }));

  for (let s = out.length - 1; s >= 0; s--) {
    if (!isNoRideSegment(out[s])) continue;
    const orphan = out[s].stations[0];
    const prev = out[s - 1];
    if (prev && orphan) {
      const last = prev.stations[prev.stations.length - 1];
      if (last?.name === orphan.name) {
        if (s === out.length - 1) last.type = "arrival";
        if (out[s].walkAfter && !prev.walkAfter) {
          prev.walkAfter = out[s].walkAfter;
        }
      } else if (s === out.length - 1) {
        // 도보로 끝나는 경우 — 이전 호선에 목적지를 붙이지 않음
        if (last.type === "arrival") last.type = "transfer";
        prev.walkAfter = {
          minutes:
            out[s].walkAfter?.minutes ??
            prev.walkAfter?.minutes ??
            MOCK_WALK_TRANSFER_MINUTES,
          destination: { ...orphan, type: "arrival" },
        };
      } else {
        prev.stations.push({ ...orphan, type: "transfer" });
        if (out[s].walkAfter) prev.walkAfter = out[s].walkAfter;
      }
    }
    out.splice(s, 1);
  }

  if (out.length) {
    const lastSeg = out[out.length - 1];
    if (!lastSeg.walkAfter?.destination) {
      const lastSt = lastSeg.stations[lastSeg.stations.length - 1];
      if (lastSt) lastSt.type = "arrival";
    }
  }
  return out;
}

/** @returns {Array<{ id, lineName, lineColor, boarding, waypoints, alighting, isLast, walkDestination? }>} */
export function buildRidingLegs(segments) {
  const cleaned = pruneNoRideSegments(segments);
  if (!cleaned.length) return [];

  return cleaned.map((seg, i) => {
    const isLastLeg = i === cleaned.length - 1;
    const walkDestination = isLastLeg ? seg.walkAfter?.destination ?? null : null;
    const boarding = {
      ...seg.stations[0],
      lineColor: seg.lineColor,
      lineName: seg.lineName,
    };

    // 하차는 이 구간 실제 종착. next 승차역을 쓰면 환승 후 다른 역(응봉)이
    // 이전 호선 하차로 잘못 표시됨
    const alighting = {
      ...seg.stations[seg.stations.length - 1],
      type: isLastLeg && !walkDestination ? "arrival" : "transfer",
      lineColor: seg.lineColor,
      lineName: seg.lineName,
    };
    const waypoints = seg.stations.slice(1, -1).map((st) => ({
      ...st,
      lineColor: seg.lineColor,
      lineName: seg.lineName,
    }));

    return {
      id: `leg-${i}`,
      lineName: seg.lineName,
      lineColor: seg.lineColor,
      boarding,
      waypoints,
      alighting,
      isLast: isLastLeg && !walkDestination,
      walkDestination,
      walkAfterMinutes: isLastLeg ? seg.walkAfter?.minutes : undefined,
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
