import { cn } from "@/lib/utils";
import { CONGESTION_STYLES } from "@/lib/congestion";

const TYPE_LABEL = {
  departure: "출발",
  arrival: "도착",
  transfer: "환승",
  waypoint: null,
};

function lineLight(hex) {
  return hex + "22";
}

export function RouteSchematic({ segments }) {
  return (
    <div className="relative">
      {segments.map((seg, si) => {
        const isLastSeg = si === segments.length - 1;

        return (
          <div key={`${seg.lineColor}-${si}`}>
            {si > 0 && (
              <div className="relative my-1 flex items-center gap-2 pl-[11px]">
                <div
                  className="absolute left-[11px] top-0 h-full w-[4px] opacity-30"
                  style={{
                    background: `repeating-linear-gradient(to bottom, ${segments[si - 1].lineColor} 0, ${segments[si - 1].lineColor} 4px, transparent 4px, transparent 8px)`,
                  }}
                />
                <div
                  className="ml-8 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{
                    backgroundColor: lineLight(seg.lineColor),
                    color: seg.lineColor,
                    border: `1px solid ${seg.lineColor}44`,
                  }}
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: seg.lineColor }}
                  />
                  {seg.lineName} 환승
                </div>
              </div>
            )}

            {seg.stations.map((st, stIdx) => {
              const isLastStation = isLastSeg && stIdx === seg.stations.length - 1;
              const isSpecial =
                st.type === "departure" || st.type === "arrival" || st.type === "transfer";
              const label = TYPE_LABEL[st.type];
              const congStyle = st.congestionStatus
                ? CONGESTION_STYLES[st.congestionStatus]
                : null;

              return (
                <div
                  key={`${st.name}-${si}-${stIdx}`}
                  className="relative"
                  style={{ minHeight: isSpecial ? 72 : 52 }}
                >
                  {!isLastStation && (
                    <div
                      className="absolute top-6 w-[4px] rounded-b-sm"
                      style={{
                        left: isSpecial ? 10 : 14,
                        height: "calc(100% - 4px)",
                        backgroundColor: seg.lineColor,
                      }}
                    />
                  )}

                  <div className="relative flex items-start gap-3">
                    <div
                      className={cn(
                        "relative z-10 mt-1 flex-shrink-0 rounded-full border-[3px] border-white shadow-md",
                        isSpecial ? "mt-[2px]" : "mt-[6px]",
                      )}
                      style={{
                        width: isSpecial ? 24 : 16,
                        height: isSpecial ? 24 : 16,
                        marginLeft: isSpecial ? 0 : 4,
                        backgroundColor: st.type === "waypoint" ? "#ffffff" : seg.lineColor,
                        borderColor: st.type === "waypoint" ? seg.lineColor : "#ffffff",
                        borderWidth: isSpecial ? 3 : 2,
                      }}
                    />

                    <div className="flex-1 pb-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "text-slate-800",
                            isSpecial ? "text-sm font-bold" : "text-sm font-medium",
                          )}
                        >
                          {st.name}역
                        </span>

                        {label && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: seg.lineColor }}
                          >
                            {label}
                          </span>
                        )}

                        {stIdx === 0 && (
                          <span
                            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              color: seg.lineColor,
                              borderColor: seg.lineColor + "66",
                              backgroundColor: lineLight(seg.lineColor),
                            }}
                          >
                            {seg.lineName} 탑승
                          </span>
                        )}

                        {st.arrivalTime && isSpecial && (
                          <span className="ml-auto font-mono text-xs tabular-nums text-slate-400">
                            {st.arrivalTime}
                          </span>
                        )}
                      </div>

                      {st.congestionRate !== undefined && isSpecial && congStyle && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className={`h-2 w-2 rounded-full ${congStyle.dot}`} />
                          <span className="text-xs text-slate-500">
                            혼잡도{" "}
                            <strong className="text-slate-700">{st.congestionRate}%</strong> —{" "}
                            {congStyle.emoji}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
