import { Footprints } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONGESTION_STYLES } from "@/lib/congestion";
import { buildRidingLegs } from "@/lib/route-station-groups";
import { RouteLegExpandToggle } from "@/components/RouteLegExpandToggle";

function TimelineLine({ color, className }) {
  return (
    <div
      className={cn("absolute left-[11px] top-6 w-[4px] rounded-b-sm", className)}
      style={{ backgroundColor: color, height: "calc(100% - 4px)" }}
    />
  );
}

function WalkConnector({ prevColor, nextColor }) {
  return (
    <div className="relative my-1 flex items-center gap-2 py-2 pl-[11px]">
      <div
        className="absolute left-[11px] top-0 h-full w-[4px]"
        style={{
          background: `repeating-linear-gradient(to bottom, ${prevColor} 0, ${prevColor} 3px, transparent 3px, transparent 7px)`,
          opacity: 0.45,
        }}
      />
      <div className="ml-8 flex items-center gap-1.5 text-xs text-slate-500">
        <Footprints className="h-3.5 w-3.5" />
        <span>도보 환승</span>
      </div>
      <div
        className="absolute bottom-0 left-[11px] h-1/2 w-[4px]"
        style={{ backgroundColor: nextColor, opacity: 0.3 }}
      />
    </div>
  );
}

function BoardingRow({ leg, showLineBelow }) {
  const { boarding, lineColor, lineName } = leg;
  const congStyle = boarding.congestionStatus
    ? CONGESTION_STYLES[boarding.congestionStatus]
    : null;

  return (
    <div className="relative" style={{ minHeight: 72 }}>
      {showLineBelow && <TimelineLine color={lineColor} />}
      <div className="relative flex items-start gap-3">
        <div
          className="relative z-10 mt-[2px] h-6 w-6 shrink-0 rounded-full border-[3px] border-white shadow-md"
          style={{ backgroundColor: lineColor }}
        />
        <div className="flex-1 pb-3">
          <p className="text-sm font-bold text-slate-800">
            <span style={{ color: lineColor }}>{lineName}</span> {boarding.name}역 승차
          </p>
          {boarding.arrivalTime && (
            <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-400">
              {boarding.arrivalTime}
            </p>
          )}
          {boarding.congestionRate !== undefined && congStyle && (
            <div className="mt-1 flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${congStyle.dot}`} />
              <span className="text-xs text-slate-500">
                혼잡도 <strong className="text-slate-700">{boarding.congestionRate}%</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WaypointRow({ station, lineColor, showLineBelow }) {
  return (
    <div className="relative" style={{ minHeight: 36 }}>
      {showLineBelow && <TimelineLine color={lineColor} className="left-[14px] !top-4" />}
      <div className="relative flex items-center gap-3 py-0.5">
        <div
          className="relative z-10 ml-1 mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 bg-white"
          style={{ borderColor: lineColor }}
        />
        <span className="text-sm text-slate-600">{station.name}역</span>
      </div>
    </div>
  );
}

function AlightingRow({ leg, showLineBelow }) {
  const { alighting, lineColor, isLast } = leg;
  const label = isLast ? "도착" : "하차";
  const congStyle = alighting.congestionStatus
    ? CONGESTION_STYLES[alighting.congestionStatus]
    : null;

  return (
    <div className="relative" style={{ minHeight: 56 }}>
      {showLineBelow && <TimelineLine color={lineColor} />}
      <div className="relative flex items-start gap-3">
        <div
          className="relative z-10 mt-[2px] h-6 w-6 shrink-0 rounded-full border-[3px] border-white shadow-md"
          style={{ backgroundColor: lineColor }}
        />
        <div className="flex-1 pb-3">
          <p className="text-sm font-bold text-slate-800">
            {alighting.name}역 {label}
          </p>
          {alighting.arrivalTime && (
            <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-400">
              {alighting.arrivalTime}
            </p>
          )}
          {alighting.congestionRate !== undefined && congStyle && (
            <div className="mt-1 flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${congStyle.dot}`} />
              <span className="text-xs text-slate-500">
                혼잡도 <strong className="text-slate-700">{alighting.congestionRate}%</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RidingLegBlock({ leg, expanded, onToggle }) {
  const expanded_ = expanded;
  const hasWaypoints = leg.waypoints.length > 0;

  return (
    <div className="relative">
      <BoardingRow leg={leg} showLineBelow={hasWaypoints || true} />

      {hasWaypoints && (
        <>
          <RouteLegExpandToggle
            count={leg.waypoints.length}
            expanded={expanded_}
            lineColor={leg.lineColor}
            onToggle={onToggle}
          />
          {expanded_ &&
            leg.waypoints.map((wp, i) => (
              <WaypointRow
                key={wp.name}
                station={wp}
                lineColor={leg.lineColor}
                showLineBelow={i < leg.waypoints.length - 1 || true}
              />
            ))}
        </>
      )}

      <AlightingRow leg={leg} showLineBelow={false} />
    </div>
  );
}

export function RouteSchematic({ segments, expandedGroups, onToggleGroup }) {
  const legs = buildRidingLegs(segments);
  if (!legs.length) return null;

  return (
    <div className="relative">
      {legs.map((leg, i) => (
        <div key={leg.id}>
          {i > 0 && (
            <WalkConnector
              prevColor={legs[i - 1].lineColor}
              nextColor={leg.lineColor}
            />
          )}
          <RidingLegBlock
            leg={leg}
            expanded={expandedGroups?.has(leg.id)}
            onToggle={() => onToggleGroup?.(leg.id)}
          />
        </div>
      ))}
    </div>
  );
}
