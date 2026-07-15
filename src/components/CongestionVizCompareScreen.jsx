import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CongestionLegend } from "@/components/CongestionLegend";
import { getRouteCongestionStats } from "@/lib/route-congestion-summary";

/** 시청→동대문 — 중간(종각)이 피크인 샘플 */
const SAMPLE_ROUTE = {
  id: "viz-sample",
  totalTime: 10,
  transfers: 0,
  payment: 1550,
  maxCongestion: 103,
  lineName: "1호선",
  description: "시청 → 동대문",
  stations: ["시청", "종각", "종로3가", "종로5가", "동대문"],
  segments: [
    {
      lineName: "1호선",
      lineColor: "#0052A4",
      stations: [
        { name: "시청", congestionRate: 72 },
        { name: "종각", congestionRate: 103 },
        { name: "종로3가", congestionRate: 68 },
        { name: "종로5가", congestionRate: 78 },
        { name: "동대문", congestionRate: 48 },
      ],
    },
  ],
};

function CongestionChip({ rate, hint }) {
  const level = rateToCrowdLevel(rate);
  const color = CROWD_COLORS[level];
  return (
    <div className="shrink-0 text-right">
      <div
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1"
        style={{ backgroundColor: `${color}22` }}
      >
        <span
          className="h-3.5 w-3.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-bold tabular-nums text-slate-800">
          {rate}%
        </span>
        <span className="text-[11px] font-semibold" style={{ color }}>
          {CROWD_LABELS[level]}
        </span>
      </div>
      {hint && (
        <p className="mt-0.5 text-[9px] text-slate-400">{hint}</p>
      )}
    </div>
  );
}

function CompareCard({ title, badgeRate, badgeHint, children }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <CongestionChip rate={badgeRate} hint={badgeHint} />
      </div>
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900">
          {SAMPLE_ROUTE.totalTime}분
        </span>
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
          최단
        </span>
        <span className="text-xs text-slate-400">
          환승 {SAMPLE_ROUTE.transfers}회
        </span>
      </div>
      {children}
    </div>
  );
}

function badgeStats(route) {
  return getRouteCongestionStats(route);
}

/**
 * 혼잡 스트립 변형 + 카드 뱃지 기준 비교 (#cong-viz)
 */
export function CongestionVizCompareScreen({ onBack }) {
  const legs = buildTimelineLegs(SAMPLE_ROUTE);
  const { max, avg, peakName, departure, departureName } =
    badgeStats(SAMPLE_ROUTE);

  return (
    <div className="animate-fade-in space-y-5 pb-8">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-slate-800">혼잡 UI 비교</h1>
          <p className="text-xs text-slate-500">
            별도 역별 스트립 · 역 구분 / 뱃지 기준
          </p>
        </div>
        <CongestionLegend compact />
      </header>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-slate-500">
          1. 역별 스트립 — 구간 구분
        </h2>

        <CompareCard
          title="① 색만 (현재)"
          badgeRate={departure}
          badgeHint={`출발 · ${departureName}`}
        >
          <div className="mt-3">
            <RouteTimelineBar legs={legs} totalTime={SAMPLE_ROUTE.totalTime} />
          </div>
          <RouteCongestionStrip
            route={SAMPLE_ROUTE}
            variant="plain"
            className="mt-2.5"
          />
        </CompareCard>

        <CompareCard
          title="② 역 사이 구분선"
          badgeRate={departure}
          badgeHint={`출발 · ${departureName}`}
        >
          <div className="mt-3">
            <RouteTimelineBar legs={legs} totalTime={SAMPLE_ROUTE.totalTime} />
          </div>
          <RouteCongestionStrip
            route={SAMPLE_ROUTE}
            variant="dividers"
            className="mt-2.5"
          />
        </CompareCard>

        <CompareCard
          title="③ 구분선 + 노선도 노드"
          badgeRate={departure}
          badgeHint={`출발 · ${departureName}`}
        >
          <div className="mt-3">
            <RouteTimelineBar legs={legs} totalTime={SAMPLE_ROUTE.totalTime} />
          </div>
          <RouteCongestionStrip
            route={SAMPLE_ROUTE}
            variant="nodes"
            className="mt-2.5"
          />
        </CompareCard>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-slate-500">
          2. 카드 우측 뱃지 기준 (같은 스트립, 숫자만 다름)
        </h2>

        <CompareCard
          title="A. 경로 최대 (이전)"
          badgeRate={max}
          badgeHint={`max · ${peakName}`}
        >
          <div className="mt-3">
            <RouteTimelineBar legs={legs} totalTime={SAMPLE_ROUTE.totalTime} />
          </div>
          <RouteCongestionStrip
            route={SAMPLE_ROUTE}
            variant="dividers"
            className="mt-2.5"
          />
        </CompareCard>

        <CompareCard
          title="B. 경로 평균"
          badgeRate={avg}
          badgeHint="stations 평균"
        >
          <div className="mt-3">
            <RouteTimelineBar legs={legs} totalTime={SAMPLE_ROUTE.totalTime} />
          </div>
          <RouteCongestionStrip
            route={SAMPLE_ROUTE}
            variant="dividers"
            className="mt-2.5"
          />
        </CompareCard>

        <CompareCard
          title="C. 출발 역 (적용)"
          badgeRate={departure}
          badgeHint={`출발 · ${departureName}`}
        >
          <div className="mt-3">
            <RouteTimelineBar legs={legs} totalTime={SAMPLE_ROUTE.totalTime} />
          </div>
          <RouteCongestionStrip
            route={SAMPLE_ROUTE}
            variant="dividers"
            className="mt-2.5"
          />
        </CompareCard>
      </section>
    </div>
  );
}
