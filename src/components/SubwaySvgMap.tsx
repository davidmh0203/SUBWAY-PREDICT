import type { MacroPredictMap } from "@/lib/types";
import { CONGESTION_STYLES } from "@/lib/congestion";

interface SubwaySvgMapProps {
  data: MacroPredictMap;
  selectedTime: string;
  showAlert?: boolean;
}

export function SubwaySvgMap({ data, selectedTime, showAlert = true }: SubwaySvgMapProps) {
  const getStyle = (id: keyof MacroPredictMap, type: "line" | "station") => {
    const status = data[id] || "SMOOTH";
    return CONGESTION_STYLES[status][type];
  };

  const isDangerPeak = selectedTime === "18:30" || data["line-2-east"] === "DANGER";

  return (
    <div className="w-full">
      {showAlert && isDangerPeak && (
        <div className={`mb-4 rounded-xl p-4 text-sm ${CONGESTION_STYLES.DANGER.bg}`}>
          <strong>⚠️ {selectedTime} 기습 위험 예보:</strong> 강남역 인근 대형 행사 보틀넥 및 퇴근 승객 밀집으로 인해{" "}
          <span className="font-bold">2호선 사당-잠실 구간</span>이 마비 상태입니다. 우회 경로 설정을 권장합니다.
        </div>
      )}

      <div className="relative flex w-full items-center justify-center overflow-x-auto rounded-2xl bg-slate-50 p-4 shadow-[inset_0_1px_4px_rgba(15,23,42,0.04)]">
        <svg viewBox="0 0 600 300" className="h-auto min-w-[500px] w-full">
          <g stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" fill="none" opacity="0.6">
            <path d="M 50 150 L 550 150" />
            <path d="M 250 50 L 250 250" />
            <path d="M 400 150 L 500 250" />
          </g>

          <g fill="none" strokeLinecap="round">
            <path d="M 50 150 L 250 150" className={getStyle("line-2-west", "line")} />
            <path d="M 250 150 L 400 150 L 550 150" className={getStyle("line-2-east", "line")} />
            <path d="M 250 50 L 250 250" className={getStyle("line-4", "line")} />
            <path d="M 400 150 L 500 250" className={getStyle("line-sinbundang", "line")} />
          </g>

          <g>
            <circle cx="50" cy="150" r="6" className="fill-slate-400 stroke-white stroke-2" />
            <text x="50" y="130" textAnchor="middle" className="text-xs fill-slate-500 font-medium">
              신도림
            </text>

            <circle cx="250" cy="150" r="10" className="fill-white stroke-slate-300 stroke-2" />
            <circle cx="250" cy="150" className={getStyle("station-sadang", "station")} />
            <text x="230" y="135" className="text-xs font-bold fill-slate-700">
              사당 (2·4)
            </text>

            <circle cx="400" cy="150" r="10" className="fill-white stroke-slate-300 stroke-2" />
            <circle cx="400" cy="150" className={getStyle("station-gangnam", "station")} />
            <text x="400" y="130" textAnchor="middle" className="text-xs font-bold fill-slate-700">
              강남 (2·신분당)
            </text>

            <circle cx="550" cy="150" r="6" className="fill-slate-400 stroke-white stroke-2" />
            <text x="550" y="130" textAnchor="middle" className="text-xs fill-slate-500 font-medium">
              잠실
            </text>
          </g>
        </svg>
      </div>

      <div className="mt-4 flex justify-end gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> 여유
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> 주의
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> 기습 혼잡
        </div>
      </div>
    </div>
  );
}
