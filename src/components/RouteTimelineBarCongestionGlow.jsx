import { Footprints, Train } from "lucide-react";
import { CROWD_COLORS, rateToCrowdLevel } from "@/lib/congestion";
import { MOCK_WALK_TRANSFER_MINUTES } from "@/lib/route-timing";
import { buildTimelineLegs } from "@/components/RouteTimelineBar";

const BAR_H = 14;
/** 호선 바보다 살짝 두꺼운 소프트 — 상하로 은은히 비침 */
const TRACK_H = 20;
const ICON = 22;

/** 혼잡색을 파스텔로 죽여서 호선색과 덜 싸움 */
function softCongestionColor(rate) {
  const hex = CROWD_COLORS[rateToCrowdLevel(rate ?? 0)];
  // #RRGGBB → rgba(..., 0.45)
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.42)`;
}

/**
 * 호선 색 막대 유지 + 뒤쪽 부드러운 혼잡 트랙(네온 글로우 없이).
 * 테스트·비교용.
 */
export function RouteTimelineBarCongestionGlow({ route }) {
  const segs = route?.segments ?? [];
  if (!segs.length) return null;

  const legs = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const stations = seg.stations ?? [];
    legs.push({
      type: "ride",
      lineName: seg.lineName,
      lineColor: seg.lineColor,
      minutes: Math.max(1, (stations.length - 1) * 2 || 4),
      stations,
    });
    const hasNext = i < segs.length - 1;
    const finalWalk = !hasNext && seg.walkAfter?.destination;
    if (hasNext || finalWalk) {
      legs.push({
        type: "walk",
        minutes:
          seg.walkAfter?.minutes > 0
            ? seg.walkAfter.minutes
            : MOCK_WALK_TRANSFER_MINUTES,
      });
    }
  }

  const built = buildTimelineLegs(route);
  const rideBuilt = built.filter((l) => l.type === "ride");
  let rideIdx = 0;
  const scaled = legs.map((leg) => {
    if (leg.type !== "ride") return leg;
    const m = rideBuilt[rideIdx]?.minutes ?? leg.minutes;
    rideIdx += 1;
    return { ...leg, minutes: m };
  });

  const sum =
    scaled.reduce((s, l) => s + Math.max(1, l.minutes), 0) ||
    route.totalTime ||
    1;

  return (
    <div
      className="flex w-full items-center gap-0.5"
      style={{ height: Math.max(ICON, TRACK_H) }}
    >
      {scaled.map((leg, i) => {
        const flex = Math.max(1, leg.minutes) / sum;
        if (leg.type === "walk") {
          return (
            <div
              key={`w-${i}`}
              className="relative flex min-w-[52px] items-center"
              style={{ flex, height: Math.max(ICON, TRACK_H) }}
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
                <Footprints className="h-3 w-3 text-white" strokeWidth={2.5} />
              </div>
              <span className="relative z-10 truncate pl-1.5 pr-1.5 text-[10px] font-semibold leading-none text-slate-600">
                {leg.minutes}분
              </span>
            </div>
          );
        }

        const stops = leg.stations?.length
          ? leg.stations
          : [{ congestionRate: 40 }];

        return (
          <div
            key={`r-${i}`}
            className="relative flex min-w-[56px] items-center"
            style={{ flex, height: Math.max(ICON, TRACK_H) }}
            title={`${leg.lineName} ${leg.minutes}분`}
          >
            {/* 혼잡 트랙: 호선 바보다 조금 두껍게, 파스텔만 — blur/neon 없음 */}
            <div
              className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 overflow-hidden rounded-full"
              style={{ height: TRACK_H }}
            >
              {stops.map((st, si) => (
                <div
                  key={`${st.name ?? si}-g`}
                  className="min-w-0 flex-1"
                  style={{
                    backgroundColor: softCongestionColor(st.congestionRate),
                  }}
                  title={
                    st.name
                      ? `${st.name} · ${st.congestionRate}%`
                      : undefined
                  }
                />
              ))}
            </div>
            {/* 호선 바: 트랙 위에 올려 위·아래로 혼잡색만 살짝 보이도록 */}
            <div
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full"
              style={{
                height: BAR_H,
                backgroundColor: leg.lineColor,
              }}
            />
            <div
              className="relative z-10 flex shrink-0 items-center justify-center rounded-full shadow-sm"
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
