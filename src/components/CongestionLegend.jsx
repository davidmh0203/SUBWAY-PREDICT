import { CROWD_COLORS, CROWD_LABELS, CROWD_PERCENT_RANGES } from "@/lib/congestion";
import { User } from "lucide-react";

const LEVELS = ["RELAXED", "NORMAL", "BUSY", "VERY_BUSY", "EXTREME"];
const ICON_COUNTS = [1, 2, 3, 4, 5];

export function CongestionLegend({ className = "", compact = false, showPercentRanges = false }) {
  return (
    <div className={`flex flex-col items-end gap-1.5 ${className}`}>
      <div className="flex h-2.5 w-40 max-w-[45vw] overflow-hidden rounded-full sm:w-48">
        {LEVELS.map((level) => (
          <div key={level} className="flex-1" style={{ backgroundColor: CROWD_COLORS[level] }} />
        ))}
      </div>
      {!compact && (
        <div className="flex w-56 justify-between">
          {LEVELS.map((level, i) => (
            <div key={level} className="flex flex-col items-center gap-0.5">
              <div className="flex -space-x-0.5">
                {Array.from({ length: ICON_COUNTS[i] }).map((_, j) => (
                  <User
                    key={j}
                    className="h-3 w-3"
                    style={{ color: CROWD_COLORS[level] }}
                    fill={CROWD_COLORS[level]}
                    strokeWidth={0}
                  />
                ))}
              </div>
              <span className="text-[9px] text-slate-500">{CROWD_LABELS[level]}</span>
              {showPercentRanges && (
                <span className="text-[8px] text-slate-400">{CROWD_PERCENT_RANGES[level]}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {compact && showPercentRanges && (
        <div className="flex w-48 flex-wrap justify-end gap-x-2 gap-y-0.5">
          {LEVELS.map((level) => (
            <span key={level} className="text-[8px] text-slate-400">
              {CROWD_LABELS[level]} {CROWD_PERCENT_RANGES[level]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function CrowdBlock({ level, label, className = "" }) {
  return (
    <div
      className={`flex items-center justify-center rounded-md text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-300 ${className}`}
      style={{ backgroundColor: CROWD_COLORS[level] }}
    >
      {label}
    </div>
  );
}
