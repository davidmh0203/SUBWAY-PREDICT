import { Footprints, Train } from "lucide-react";
import { CONGESTION_STYLES } from "@/lib/congestion";
import { buildRidingLegs } from "@/lib/route-station-groups";
import { RouteLegExpandToggle } from "@/components/RouteLegExpandToggle";
import { MOCK_WALK_TRANSFER_MINUTES } from "@/lib/route-timing";

function WalkConnector({ prevColor, nextColor, minutes }) {
  const walkMin =
    minutes != null && minutes > 0 ? minutes : MOCK_WALK_TRANSFER_MINUTES;
  return (
    <div className="relative -mt-2 mb-1 flex items-center gap-2 py-1.5 pl-[11px]">
      <div
        className="absolute left-[11px] top-0 h-full w-[4px]"
        style={{
          background: `repeating-linear-gradient(to bottom, ${prevColor} 0, ${prevColor} 3px, transparent 3px, transparent 7px)`,
          opacity: 0.45,
        }}
      />
      <div className="ml-8 flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-xs text-slate-600">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-slate-500">
          <Footprints className="h-3 w-3 text-white" strokeWidth={2.5} />
        </span>
        <span>
          환승 도보 <strong className="tabular-nums text-slate-800">{walkMin}분</strong>
        </span>
      </div>
      <div
        className="absolute bottom-0 left-[11px] h-1/2 w-[4px]"
        style={{ backgroundColor: nextColor, opacity: 0.3 }}
      />
    </div>
  );
}

function BoardingRow({ leg }) {
  const { boarding, lineColor, lineName } = leg;
  const congStyle = boarding.congestionStatus
    ? CONGESTION_STYLES[boarding.congestionStatus]
    : null;

  return (
    <div className="relative" style={{ minHeight: 72 }}>
      <div className="relative flex items-start gap-3">
        <div
          className="relative z-10 mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[3px] border-white shadow-md"
          style={{ backgroundColor: lineColor }}
        >
          <Train className="h-3 w-3 text-white" strokeWidth={2.5} />
        </div>
        <div className="flex-1 pb-3">
          <p className="text-sm font-bold text-slate-800">
            <span style={{ color: lineColor }}>{lineName}</span> {boarding.name}역 승차
          </p>
          {boarding.arrivalTime && (
            <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-400">
              {boarding.arrivalTime}
            </p>
          )}
          {boarding.heading && (
            <p className="mt-0.5 text-xs text-slate-500">{boarding.heading}</p>
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

function WaypointRow({ station, lineColor }) {
  return (
    <div className="relative" style={{ minHeight: 36 }}>
      <div className="relative flex items-center gap-3 py-0.5">
        <div
          className="relative z-10 mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2"
          style={{
            marginLeft: "2px",
            borderColor: lineColor,
            backgroundColor: "#ffffff",
          }}
        />
        <span className="text-sm text-slate-600">{station.name}역</span>
      </div>
    </div>
  );
}

function AlightingRow({ leg }) {
  const { alighting, lineColor, isLast } = leg;
  const label = isLast ? "도착" : "하차";
  const congStyle = alighting.congestionStatus
    ? CONGESTION_STYLES[alighting.congestionStatus]
    : null;

  return (
    <div className="relative" style={{ minHeight: 56 }}>
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
  const bottomCut = hasWaypoints && expanded_ ? 18 : 26;

  return (
    <div className="relative">
      <div
        className="absolute left-[11px] top-[14px] w-[4px]"
        style={{
          backgroundColor: leg.lineColor,
          height: `calc(100% - ${bottomCut}px)`,
        }}
      />
      <BoardingRow leg={leg} />

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
              />
            ))}
        </>
      )}

      <AlightingRow leg={leg} />
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
              minutes={
                segments[i - 1]?.walkAfter?.minutes ?? MOCK_WALK_TRANSFER_MINUTES
              }
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
