import { Footprints, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineBadge } from "@/components/LineBadge";
import {
  RouteTimelineBar,
  buildTimelineLegs,
} from "@/components/RouteTimelineBar";
import { RouteCongestionStrip } from "@/components/RouteCongestionStrip";
import {
  CROWD_COLORS,
  CROWD_LABELS,
  rateToCrowdLevel,
} from "@/lib/congestion";
import { getCardCongestionRate } from "@/lib/route-congestion-summary";
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
        const finalWalk = !hasNext && seg.walkAfter?.destination;
        const walkMin =
          hasNext || finalWalk
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
                  {finalWalk
                    ? `도보 ${walkMin}분 · ${seg.walkAfter.destination.name}`
                    : `환승 도보 ${walkMin}분${
                        segs[i + 1] ? ` · ${segs[i + 1].lineName}` : ""
                      }`}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const BADGE_STYLE = {
  shortest: "bg-blue-50 text-blue-700",
  comfortable: "bg-emerald-50 text-emerald-700",
};

const BADGE_LABEL = {
  shortest: "최단",
  comfortable: "쾌적",
};

/**
 * 네이버 지도 스타일 경로 카드 — 예상 시간 중심 + 호선/혼잡 타임라인
 */
export function RouteOptionCard({
  route,
  departureTime,
  badges = [],
  scheduleTag = null,
  timeDiff,
  onClick,
  isFavorited = false,
  favoriteDisabled = false,
  onToggleFavorite,
}) {
  const legs = buildTimelineLegs(route);
  const arriveAt = formatArrivalTime(departureTime, route.totalTime);
  const departAt = formatClock(departureTime);
  const cardCongestion = getCardCongestionRate(route);
  const crowdLevel = rateToCrowdLevel(cardCongestion);
  const crowdColor = CROWD_COLORS[crowdLevel];
  const isFeatured = badges.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`w-full cursor-pointer rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:shadow-[0_2px_8px_rgba(15,23,42,0.08)] ${
        isFeatured ? "ring-1 ring-slate-200" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {route.totalTime}분
            </span>
            {badges.map((b) => (
              <span
                key={b}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${BADGE_STYLE[b] ?? "bg-slate-100 text-slate-600"}`}
              >
                {BADGE_LABEL[b] ?? b}
              </span>
            ))}
            {scheduleTag && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                {scheduleTag}
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
        <div className="flex shrink-0 items-start gap-1.5">
          <div className="text-right">
            <p className="text-xs text-slate-500">
              환승{" "}
              <strong className="text-slate-800">{route.transfers}</strong>회
            </p>
            <div
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1"
              style={{ backgroundColor: `${crowdColor}22` }}
            >
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: crowdColor }}
                aria-hidden
              />
              <span className="text-sm font-bold tabular-nums text-slate-800">
                {cardCongestion}%
              </span>
              <span className="text-[11px] font-semibold" style={{ color: crowdColor }}>
                {CROWD_LABELS[crowdLevel]}
              </span>
            </div>
            <p className="mt-0.5 text-[9px] text-slate-400">출발</p>
          </div>
          {onToggleFavorite && (
            <button
              type="button"
              aria-label={isFavorited ? "즐겨찾기 해제" : "즐겨찾기 추가"}
              title={favoriteDisabled ? "즐겨찾기는 5개까지 저장할 수 있습니다" : undefined}
              disabled={favoriteDisabled}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={cn(
                "-mr-1 -mt-1 rounded-lg p-1.5 transition hover:bg-slate-50",
                favoriteDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
              )}
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  isFavorited ? "fill-amber-400 text-amber-400" : "text-slate-300",
                )}
              />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <RouteTimelineBar legs={legs} totalTime={route.totalTime} />
      </div>

      <RouteCongestionStrip route={route} className="mt-2.5" />

      <div className="mt-3">
        <TransferOutline route={route} />
      </div>
    </div>
  );
}
