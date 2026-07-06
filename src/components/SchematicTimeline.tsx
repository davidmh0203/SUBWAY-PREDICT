import { Badge } from "@/components/ui/badge";
import { CONGESTION_STYLES } from "@/lib/congestion";
import type { StationPrediction } from "@/lib/types";

interface SchematicTimelineProps {
  predictions: StationPrediction[];
}

const NODE_LABELS: Record<string, string> = {
  신도림: "출발",
  신림: "주의",
  사당: "위험",
  강남: "도착",
};

export function SchematicTimeline({ predictions }: SchematicTimelineProps) {
  return (
    <div className="relative pl-2">
      {predictions.map((node, i) => {
        const style = CONGESTION_STYLES[node.status];
        const isLast = i === predictions.length - 1;
        const showAlternative =
          node.trigger === "KOPIS_EVENT" || node.congestionRate >= 120;
        const tag = NODE_LABELS[node.stationName] ?? "경유";

        return (
          <div key={node.stationId} className="relative pb-0" style={{ minHeight: 100 }}>
            {!isLast && (
              <div
                className={`absolute left-[11px] top-8 h-[calc(100%-8px)] ${style.width} ${style.border} transition-all duration-500`}
              />
            )}
            <div className="relative flex gap-4">
              <div className="relative z-10 mt-1 flex flex-col items-center">
                <div
                  className={`h-6 w-6 rounded-full border-2 border-white ${style.dot} shadow-[0_1px_4px_rgba(15,23,42,0.15)] transition-all duration-500`}
                />
              </div>
              <div className="flex-1 pb-8">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={node.status === "SMOOTH" ? "smooth" : node.status === "WARNING" ? "warning" : "danger"}>
                    {style.emoji} [{tag}]
                  </Badge>
                  <span className="font-semibold text-slate-800">{node.stationName}역</span>
                  {i === 0 && (
                    <span className="text-xs text-slate-400">(2호선 외선순환 탑승)</span>
                  )}
                  <span className="ml-auto text-sm tabular-nums text-slate-400">
                    {node.arrivalTime}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  예측 구간 혼잡도 {node.congestionRate}%
                  {node.status === "SMOOTH" && " — 쾌적하게 착석 가능"}
                  {node.status === "WARNING" && " — 승객 유입 급증"}
                  {node.status === "DANGER" && " — 대형 콘서트 영향 퇴장군"}
                </p>
                {showAlternative && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-4 shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)]">
                    <p className="mb-1 text-xs font-medium text-slate-500">대안 안내</p>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {node.stationName}역에서 하차 후 4분 뒤에 오는 다음 열차를
                      탑승하시면 내부 혼잡도가 <strong className="text-emerald-700">40% 감소</strong>합니다.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
