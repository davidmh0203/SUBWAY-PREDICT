import { ArrowLeft, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RouteOptionCard } from "@/components/RouteOptionCard";
import {
  DEFAULT_ROUTE_CARD_STYLE,
  ROUTE_CARD_STYLE_IDS,
  ROUTE_CARD_STYLE_PRESETS,
  readRouteCardStyle,
  writeRouteCardStyle,
} from "@/lib/route-card-styles";
import { cn } from "@/lib/utils";

/** 시안 비교용 샘플 — 최단 / 쾌적 / 둘 다 / 일반 */
const SAMPLE_DEPARTURE = new Date(2026, 6, 22, 8, 30);

function sampleRoute({ id, totalTime, transfers, payment, congestion, stations, lineName, lineColor }) {
  const segs = [
    {
      lineName,
      lineColor,
      stations: stations.map((name, i) => ({
        name,
        congestionRate: congestion[i] ?? congestion[0],
      })),
    },
  ];
  return {
    id,
    totalTime,
    transfers,
    payment,
    maxCongestion: Math.max(...congestion),
    description: `${stations[0]} → ${stations[stations.length - 1]}`,
    stations,
    segments: segs,
  };
}

const SAMPLES = [
  {
    badges: ["shortest"],
    timeDiff: 0,
    route: sampleRoute({
      id: "sample-short",
      totalTime: 28,
      transfers: 0,
      payment: 1550,
      congestion: [72, 88, 65, 58],
      stations: ["시청", "종각", "종로3가", "동대문"],
      lineName: "1호선",
      lineColor: "#0052A4",
    }),
  },
  {
    badges: ["comfortable"],
    timeDiff: 5,
    route: sampleRoute({
      id: "sample-comfort",
      totalTime: 33,
      transfers: 1,
      payment: 1550,
      congestion: [48, 52, 55, 50],
      stations: ["시청", "을지로3가", "동대문역사문화공원", "동대문"],
      lineName: "2호선",
      lineColor: "#00A84D",
    }),
  },
  {
    badges: ["shortest", "comfortable"],
    timeDiff: 0,
    route: sampleRoute({
      id: "sample-both",
      totalTime: 30,
      transfers: 0,
      payment: 1550,
      congestion: [45, 50, 48],
      stations: ["합정", "홍대입구", "신촌"],
      lineName: "2호선",
      lineColor: "#00A84D",
    }),
  },
  {
    badges: [],
    timeDiff: 8,
    route: sampleRoute({
      id: "sample-plain",
      totalTime: 36,
      transfers: 1,
      payment: 1650,
      congestion: [70, 82, 90, 75],
      stations: ["시청", "서울역", "사당", "강남"],
      lineName: "4호선",
      lineColor: "#00A5DE",
    }),
  },
];

/**
 * 경로 카드 강조 시안 비교 (#card-style)
 */
export function RouteCardStyleCompareScreen({ onBack }) {
  const [selected, setSelected] = useState(() => readRouteCardStyle());

  const apply = (id) => {
    setSelected(id);
    writeRouteCardStyle(id);
  };

  return (
    <div className="animate-fade-in space-y-4 pb-10">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="뒤로" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-semibold text-slate-800">경로 카드 강조 시안</h1>
          <p className="text-xs text-slate-500">
            최단·쾌적 라벨색을 연한 배경으로 · 고르면 바로 적용됩니다
          </p>
        </div>
      </header>

      <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
        노선도 혼잡 halo처럼 라벨색(최단 파란 / 쾌적 초록)을 낮은 투명도로 깔아
        구분합니다. 아래에서 시안을 고르면 경로 결과 화면에 저장됩니다.
      </p>

      <div className="space-y-6">
        {ROUTE_CARD_STYLE_IDS.map((id) => {
          const preset = ROUTE_CARD_STYLE_PRESETS[id];
          const active = selected === id;
          return (
            <section key={id} className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">{preset.title}</h2>
                  <p className="text-[11px] text-slate-500">{preset.blurb}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="shrink-0 gap-1"
                  onClick={() => apply(id)}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                  {active ? "적용 중" : "이 시안 적용"}
                </Button>
              </div>
              <div
                className={cn(
                  "space-y-2.5 rounded-2xl border p-2.5",
                  active ? "border-slate-300 bg-slate-50/80" : "border-slate-100",
                )}
              >
                {SAMPLES.map(({ route, badges, timeDiff }) => (
                  <RouteOptionCard
                    key={`${id}-${route.id}`}
                    route={route}
                    departureTime={SAMPLE_DEPARTURE}
                    badges={badges}
                    timeDiff={timeDiff}
                    cardStyleId={id}
                    onClick={() => apply(id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-slate-400">
        기본값: {ROUTE_CARD_STYLE_PRESETS[DEFAULT_ROUTE_CARD_STYLE].title}
      </p>
    </div>
  );
}
