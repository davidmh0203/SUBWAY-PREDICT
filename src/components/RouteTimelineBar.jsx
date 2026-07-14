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

/** 경로 segments → 타임라인 레그 (탑승 + 환승 도보) */
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

  return legs;
}

/**
 * pill 타임라인: 지하철=둥근 호선색 원+흰 기차 아이콘, 도보=각진 배지+시간
 */
export function RouteTimelineBar({ legs, totalTime }) {
  if (!legs?.length) return null;
  const sum =
    legs.reduce((s, l) => s + Math.max(1, l.minutes), 0) || totalTime || 1;

  return (
    <div className="flex h-5 w-full items-stretch gap-px overflow-hidden rounded-full bg-slate-100 p-0.5">
      {legs.map((leg, i) => {
        const flex = Math.max(1, leg.minutes) / sum;
        if (leg.type === "walk") {
          return (
            <div
              key={`w-${i}`}
              className="relative flex min-w-[52px] items-center gap-1 rounded-sm bg-slate-200/90 px-0.5"
              style={{ flex }}
              title={`환승 도보 ${leg.minutes}분`}
            >
              <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-slate-500">
                <Footprints
                  className="h-2.5 w-2.5 text-white"
                  strokeWidth={2.5}
                />
              </div>
              <span className="truncate text-[9px] font-semibold leading-none text-slate-600">
                {leg.minutes}분
              </span>
            </div>
          );
        }

        return (
          <div
            key={`r-${i}`}
            className="relative flex min-w-[56px] items-center gap-1 rounded-full px-0.5"
            style={{ flex, backgroundColor: leg.lineColor }}
            title={`${leg.lineName} ${leg.minutes}분`}
          >
            <div
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ring-1 ring-white/70"
              style={{ backgroundColor: leg.lineColor }}
            >
              <Train className="h-2 w-2 text-white" strokeWidth={2.5} />
            </div>
            <span className="truncate pr-1 text-[9px] font-semibold leading-none text-white drop-shadow-sm">
              {leg.minutes}분
            </span>
          </div>
        );
      })}
    </div>
  );
}
