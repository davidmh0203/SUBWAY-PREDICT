/**
 * 경로 목록 정렬·뱃지 (최단 / 쾌적)
 */

import { getComfortRankRate } from "@/lib/route-congestion-summary";

function denseRankMap(routes, keyFn) {
  const sorted = [...routes].sort((a, b) => keyFn(a) - keyFn(b));
  /** @type {Map<string, number>} */
  const map = new Map();
  let rank = 0;
  let prev = null;
  for (const route of sorted) {
    const v = keyFn(route);
    if (prev === null || v !== prev) {
      rank += 1;
      prev = v;
    }
    map.set(route.id, rank);
  }
  return map;
}

/**
 * @param {Array<{ id: string, totalTime?: number, maxCongestion?: number, departureCongestion?: number, transfers?: number }>} routes
 * @returns {Array<{ route: object, badges: Array<'shortest'|'comfortable'> }>}
 */
export function rankRoutes(routes) {
  if (!routes?.length) return [];

  const minTime = Math.min(...routes.map((r) => Number(r.totalTime) || 999));
  const minCong = Math.min(
    ...routes.map((r) => {
      const rate = getComfortRankRate(r);
      return Number.isFinite(rate) ? rate : 999;
    }),
  );

  const timeRanks = denseRankMap(routes, (r) => Number(r.totalTime) || 999);
  const congRanks = denseRankMap(routes, (r) => {
    const rate = getComfortRankRate(r);
    return Number.isFinite(rate) ? rate : 999;
  });

  const decorated = routes.map((route) => {
    /** @type {Array<'shortest'|'comfortable'>} */
    const badges = [];
    if ((Number(route.totalTime) || 999) === minTime) badges.push("shortest");
    const comfortRate = getComfortRankRate(route);
    if (Number.isFinite(comfortRate) && comfortRate === minCong) {
      badges.push("comfortable");
    }
    const score =
      (timeRanks.get(route.id) ?? 99) + (congRanks.get(route.id) ?? 99);
    return { route, badges, score };
  });

  decorated.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const ta = Number(a.route.totalTime) || 999;
    const tb = Number(b.route.totalTime) || 999;
    if (ta !== tb) return ta - tb;
    const ca = getComfortRankRate(a.route) || 999;
    const cb = getComfortRankRate(b.route) || 999;
    if (ca !== cb) return ca - cb;
    return (a.route.transfers ?? 99) - (b.route.transfers ?? 99);
  });

  return decorated.map(({ route, badges }) => ({ route, badges }));
}
