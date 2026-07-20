import { ArrowLeft, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractiveMetroMap } from "@/components/InteractiveMetroMap";

const VARIANTS = [
  {
    id: "baseline",
    title: "① Baseline",
    blurb: "현재 프로덕션 표현. 대조군.",
    mapStyle: "baseline",
  },
  {
    id: "cleanNodes",
    title: "② Clean Nodes",
    blurb: "동일 좌표 · 일반역 흰 원+호선색 링, 환승 큰 화이트 디스크, 선 두께 통일.",
    mapStyle: "cleanNodes",
  },
  {
    id: "labelDiscipline",
    title: "③ Label Discipline",
    blurb: "② + 8방위 직교 라벨, 노드 기준 재배치. 줌 아웃 시 환승명만(비교에선 forceShow).",
    mapStyle: "labelDiscipline",
  },
  {
    id: "stationCompact",
    title: "④ Station Compact (추천)",
    blurb: "③ + 도심 소폭 이완. 빽빽한 구간을 펴고 외곽은 유지.",
    mapStyle: "stationCompact",
    selected: true,
  },
];

/**
 * 노선도 표현 시안 비교 (#map-style-viz)
 */
export function MapStyleVizCompareScreen({
  onBack,
  onOpenCongMapViz,
  onOpenStripViz,
}) {
  return (
    <div className="animate-fade-in space-y-5 pb-8">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-slate-800">노선도 표현 시안</h1>
          <p className="text-xs text-slate-500">
            좌표는 capital SVG 유지 · 노드·라벨·도심 이완만 비교
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        {onOpenCongMapViz && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-2 text-xs"
            onClick={onOpenCongMapViz}
          >
            <Layers className="h-3.5 w-3.5" />
            혼잡 강조 시안
          </Button>
        )}
        {onOpenStripViz && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-2 text-xs"
            onClick={onOpenStripViz}
          >
            경로 스트립·뱃지 시안
          </Button>
        )}
      </div>

      <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
        서울 1–8호선만 표시합니다. 각 지도를 드래그·줌해서 시청·강남·사당 밀집부를
        비교하세요. 확정 후 `#macro`에 적용합니다.
      </p>

      {VARIANTS.map((v) => (
        <section key={v.id} className="space-y-2">
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-slate-800">{v.title}</h2>
              {v.selected && (
                <span className="text-[10px] font-medium text-emerald-700">
                  추천
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">{v.blurb}</p>
          </div>
          <div
            className={`overflow-hidden rounded-2xl border bg-white p-2 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${
              v.selected
                ? "border-slate-800 ring-1 ring-slate-800"
                : "border-slate-100"
            }`}
          >
            <InteractiveMetroMap
              selectedTime="18:30"
              seoulOnly
              hideLegendChips={false}
              showLineCongestion={false}
              busyHighlightMode="off"
              forceShowLabels
              mapStyle={v.mapStyle}
              mapHeightClass="h-[min(48vh,380px)]"
            />
          </div>
        </section>
      ))}
    </div>
  );
}
