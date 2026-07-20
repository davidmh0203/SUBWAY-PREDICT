import { ArrowLeft, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractiveMetroMap } from "@/components/InteractiveMetroMap";
import { CongestionLegend } from "@/components/CongestionLegend";

const VARIANTS = [
  {
    id: "nodes",
    title: "① 노드 채색",
    blurb: "보통 초과 역만 원에 혼잡색. 여유·보통은 기존 흰 점.",
    mode: "nodes",
  },
  {
    id: "labelBg",
    title: "② 역명 배경색",
    blurb: "혼잡 역 이름만 색 배경 + 흰 글자. 노드는 그대로.",
    mode: "labelBg",
  },
  {
    id: "rings",
    title: "③ 노드 링",
    blurb: "역 주변에 얇은 색 링. 노선 원형은 유지.",
    mode: "rings",
  },
  {
    id: "halo",
    title: "④ 소프트 할로 (적용)",
    blurb: "노드 아래 옅은 색 원·그림자. 역명·노드 집중을 해치지 않음.",
    mode: "halo",
    selected: true,
  },
  {
    id: "busyLabels",
    title: "⑤ 혼잡 역명만",
    blurb: "라벨을 혼잡 역만 표시(배경색). 지도가 가장 깔끔.",
    mode: "busyLabels",
  },
];

/**
 * 노선도 혼잡 강조 시안 (#map-cong-viz)
 * — 보통 초과만, 구간 오버레이 없이 가볍게
 */
export function MapCongestionVizCompareScreen({
  onBack,
  onOpenStripViz,
  onOpenStyleViz,
}) {
  return (
    <div className="animate-fade-in space-y-5 pb-8">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-slate-800">노선도 혼잡 시안</h1>
          <p className="text-xs text-slate-500">
            보통 초과만 · ④ 소프트 할로 적용됨
          </p>
        </div>
        <CongestionLegend compact showPercentRanges />
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        {onOpenStripViz && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-2 text-xs"
            onClick={onOpenStripViz}
          >
            <Map className="h-3.5 w-3.5" />
            경로 스트립·뱃지 시안 보기
          </Button>
        )}
        {onOpenStyleViz && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-2 text-xs"
            onClick={onOpenStyleViz}
          >
            노선도 표현 시안 보기
          </Button>
        )}
      </div>

      <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
        데모 데이터로 피크 역만 표시합니다. 실제 모델 연동 시 같은 스타일만
        갈아끼우면 됩니다. 지도를 드래그·줌해서 확인하세요.
      </p>

      {VARIANTS.map((v) => (
        <section key={v.id} className="space-y-2">
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-slate-800">{v.title}</h2>
              {v.selected && (
                <span className="text-[10px] font-medium text-emerald-700">적용</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">{v.blurb}</p>
          </div>
          <div
            className={`overflow-hidden rounded-2xl border bg-white p-2 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${
              v.selected ? "border-slate-800 ring-1 ring-slate-800" : "border-slate-100"
            }`}
          >
            <InteractiveMetroMap
              selectedTime="18:30"
              seoulOnly
              hideLegendChips={false}
              showLineCongestion={false}
              busyHighlightMode={v.mode}
              forceShowLabels={
                v.mode === "labelBg" || v.mode === "busyLabels"
              }
              mapHeightClass="h-[min(42vh,320px)]"
            />
          </div>
        </section>
      ))}
    </div>
  );
}
