import { Footprints, Train } from "lucide-react";
import { MOCK_WALK_TRANSFER_MINUTES } from "@/lib/route-timing";

function segmentRideMinutes(seg) {
  const stops = Math.max(1, seg.stations.length - 1);
  return Math.max(1, stops * 2);
}

function rideMinutesFromSegment(seg) {
  const a = seg.stations[0];
  const b = seg.stations[seg.stations.length - 1];
  if (a?.arrivalTime && b?.arrivalTime && a.arrivalTime !== b.arrivalTime) {
    const [ah, am] = a.arrivalTime.split(":").map(Number);
    const [bh, bm] = b.arrivalTime.split(":").map(Number);
    let diff = bh * 60 + bm - (ah * 60 + am);
    if (diff < 0) diff += 24 * 60;
    if (diff > 0) return diff;
  }
  return segmentRideMinutes(seg);
}

/** 경로 segments → 타임라인 레그 (탑승 + 환승 도보). 합이 route.totalTime과 일치하도록 보정. */
export function buildTimelineLegs(route) {
  const segs = route.segments ?? [];
  const legs = [];

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    legs.push({
      type: "ride",
      lineName: seg.lineName,
      lineColor: seg.lineColor,
      minutes: rideMinutesFromSegment(seg),
      from: seg.stations[0]?.name,
      to: seg.stations[seg.stations.length - 1]?.name,
    });

    const hasNext = i < segs.length - 1;
    if (!hasNext) continue;

    const walkMin =
      seg.walkAfter?.minutes != null && seg.walkAfter.minutes > 0
        ? seg.walkAfter.minutes
        : MOCK_WALK_TRANSFER_MINUTES;

    legs.push({
      type: "walk",
      minutes: walkMin,
      label: "환승 도보",
    });
  }

  const target = Number(route.totalTime);
  if (!target || !legs.length) return legs;

  const walkSum = legs
    .filter((l) => l.type === "walk")
    .reduce((s, l) => s + l.minutes, 0);
  const rideLegs = legs.filter((l) => l.type === "ride");
  const rideSum = rideLegs.reduce((s, l) => s + l.minutes, 0) || 1;
  const rideBudget = Math.max(rideLegs.length, target - walkSum);

  return legs.map((leg) => {
    if (leg.type !== "ride") return leg;
    return {
      ...leg,
      minutes: Math.max(1, Math.round((leg.minutes / rideSum) * rideBudget)),
    };
  });
}

/** 네이버지도 비율: 막대보다 원이 크고(~1.5배), 원은 막대 시작 캡 */
const BAR_H = 15;
const ICON = 22;

/**
 * 네이버지도 스타일 타임라인
 * - 원 지름 > 막대 두께, 세로 중앙 정렬
 * - 원이 막대 왼쪽 시작 캡 (왼쪽에 막대 잔재 없음)
 */
export function RouteTimelineBar({ legs, totalTime }) {
  if (!legs?.length) return null;
  const sum =
    legs.reduce((s, l) => s + Math.max(1, l.minutes), 0) || totalTime || 1;

  return (
    <div
      className="flex w-full items-center gap-0.5"
      style={{ height: ICON }}
    >
      {legs.map((leg, i) => {
        const flex = Math.max(1, leg.minutes) / sum;
        if (leg.type === "walk") {
          return (
            <div
              key={`w-${i}`}
              className="relative flex min-w-[52px] items-center"
              style={{ flex, height: ICON }}
              title={`환승 도보 ${leg.minutes}분`}
            >
              <div
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-slate-200"
                style={{ height: BAR_H }}
              />
              <div
                className="relative z-10 flex shrink-0 items-center justify-center rounded-full bg-slate-400"
                style={{ width: ICON, height: ICON }}
              >
                <Footprints
                  className="h-3 w-3 text-white"
                  strokeWidth={2.5}
                />
              </div>
              <span className="relative z-10 truncate pl-1.5 pr-1.5 text-[10px] font-semibold leading-none text-slate-600">
                {leg.minutes}분
              </span>
            </div>
          );
        }

        return (
          <div
            key={`r-${i}`}
            className="relative flex min-w-[56px] items-center"
            style={{ flex, height: ICON }}
            title={`${leg.lineName} ${leg.minutes}분`}
          >
            <div
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full"
              style={{ height: BAR_H, backgroundColor: leg.lineColor }}
            />
            <div
              className="relative z-10 flex shrink-0 items-center justify-center rounded-full"
              style={{
                width: ICON,
                height: ICON,
                backgroundColor: leg.lineColor,
              }}
            >
              <Train className="h-3 w-3 text-white" strokeWidth={2.5} />
            </div>
            <span className="relative z-10 truncate pl-1.5 pr-2 text-[10px] font-semibold leading-none text-white drop-shadow-sm">
              {leg.minutes}분
            </span>
          </div>
        );
      })}
    </div>
  );
}
