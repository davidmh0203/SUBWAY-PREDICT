import { Footprints } from "lucide-react";
import { LineBadge } from "@/components/LineBadge";
import {
  RouteTimelineBar,
  buildTimelineLegs,
} from "@/components/RouteTimelineBar";
import { CROWD_LABELS, rateToCrowdLevel } from "@/lib/congestion";
import {
  formatArrivalTime,
  MOCK_WALK_TRANSFER_MINUTES,
} from "@/lib/route-timing";

function formatClock(date) {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function TransferOutline({ route }) {
  const segs = route.segments ?? [];
  if (!segs.length) {
    return (
      <p className="truncate text-xs text-slate-500">{route.description}</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {segs.map((seg, i) => {
        const board = seg.stations[0]?.name;
        const alight = seg.stations[seg.stations.length - 1]?.name;
        const hasNext = i < segs.length - 1;
        const walkMin = hasNext
          ? seg.walkAfter?.minutes != null && seg.walkAfter.minutes > 0
            ? seg.walkAfter.minutes
            : MOCK_WALK_TRANSFER_MINUTES
          : null;

        return (
          <div key={`${seg.lineName}-${i}`} className="flex items-start gap-2">
            <LineBadge lineKey={seg.lineName} color={seg.lineColor} size="sm" />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-xs font-medium text-slate-700">
                <span style={{ color: seg.lineColor }}>{seg.lineName}</span>
                <span className="text-slate-400"> · </span>
                {board} → {alight}
              </p>
              {walkMin != null && (
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-slate-400">
                    <Footprints className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
                  </span>
                  환승 도보 {walkMin}분
                  {segs[i + 1] ? ` · ${segs[i + 1].lineName}` : ""}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 네이버 지도 스타일 경로 카드 — 예상 시간 중심 + 호선 색 타임라인
 */
export function RouteOptionCard({
  route,
  departureTime,
  isRecommended,
  timeDiff,
  onClick,
}) {
  const legs = buildTimelineLegs(route);
  const arriveAt = formatArrivalTime(departureTime, route.totalTime);
  const departAt = formatClock(departureTime);
  const crowdLevel = rateToCrowdLevel(route.maxCongestion);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:shadow-[0_2px_8px_rgba(15,23,42,0.08)] ${
        isRecommended ? "ring-1 ring-blue-100" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {route.totalTime}분
            </span>
            {isRecommended && (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                최적
              </span>
            )}
            {timeDiff > 0 && (
              <span className="text-xs text-slate-400">+{timeDiff}분</span>
            )}
          </div>
          <p className="mt-0.5 text-sm tabular-nums text-slate-500">
            {departAt} – {arriveAt}
            <span className="mx-1.5 text-slate-300">|</span>
            {route.payment?.toLocaleString()}원
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-slate-500">
            환승{" "}
            <strong className="text-slate-800">{route.transfers}</strong>회
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            {CROWD_LABELS[crowdLevel]} · 최대 {route.maxCongestion}%
          </p>
        </div>
      </div>

      <div className="mt-3">
        <RouteTimelineBar legs={legs} totalTime={route.totalTime} />
      </div>

      <div className="mt-3">
        <TransferOutline route={route} />
      </div>
    </button>
  );
}
