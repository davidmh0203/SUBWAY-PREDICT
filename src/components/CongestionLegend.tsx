import { CROWD_COLORS, CROWD_LABELS } from "@/lib/congestion";
import type { CrowdLevel } from "@/lib/types";
import { User } from "lucide-react";

const LEVELS: CrowdLevel[] = ["RELAXED", "NORMAL", "BUSY", "VERY_BUSY"];
const ICON_COUNTS = [1, 2, 3, 4];

interface CongestionLegendProps {
  className?: string;
  compact?: boolean;
}

export function CongestionLegend({ className = "", compact = false }: CongestionLegendProps) {
  return (
    <div className={`flex flex-col items-end gap-1.5 ${className}`}>
      <div className="flex h-2.5 w-48 overflow-hidden rounded-full">
        {LEVELS.map((level) => (
          <div key={level} className="flex-1" style={{ backgroundColor: CROWD_COLORS[level] }} />
        ))}
      </div>
      {!compact && (
        <div className="flex w-48 justify-between">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CrowdBlock({
  level,
  label,
  className = "",
}: {
  level: CrowdLevel;
  label?: string | number;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-md text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-300 ${className}`}
      style={{ backgroundColor: CROWD_COLORS[level] }}
    >
      {label}
    </div>
  );
}
