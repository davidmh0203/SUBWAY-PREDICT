import { Footprints, Train } from "lucide-react";
import { CROWD_COLORS, rateToCrowdLevel } from "@/lib/congestion";
import { buildRidingLegs } from "@/lib/route-station-groups";
import { RouteLegExpandToggle } from "@/components/RouteLegExpandToggle";
import { MOCK_WALK_TRANSFER_MINUTES } from "@/lib/route-timing";
import { formatStationLabel } from "@/lib/station-name";

/** 승차/경유/하차 아이콘 열 너비(w-6=24). 세로 라인 중심 = 이 열의 중심 */
const RAIL_COL = "w-6";
/** (24 - 4) / 2 = 10 */
const RAIL_LINE_LEFT = "left-[10px]";

function CongestionChip({ rate }) {
  if (rate === undefined || rate === null) return null;
  const color = CROWD_COLORS[rateToCrowdLevel(rate)];
  return (
    <div
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1"
      style={{ backgroundColor: `${color}22` }}
    >
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-sm font-bold tabular-nums text-slate-800">{rate}%</span>
      <span className="text-[11px] font-medium text-slate-600">혼잡</span>
    </div>
  );
}

function WalkConnector({ prevColor, nextColor, minutes, label = "환승 도보" }) {
  const walkMin =
    minutes != null && minutes > 0 ? minutes : MOCK_WALK_TRANSFER_MINUTES;
  return (
    <div className={`relative -mt-2 mb-1 flex items-center gap-2 py-1.5 ${RAIL_COL} pl-0`}>
      <div
        className={`absolute ${RAIL_LINE_LEFT} top-0 h-full w-[4px]`}
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
          {label} <strong className="tabular-nums text-slate-800">{walkMin}분</strong>
        </span>
      </div>
      {nextColor ? (
        <div
          className={`absolute bottom-0 ${RAIL_LINE_LEFT} h-1/2 w-[4px]`}
          style={{ backgroundColor: nextColor, opacity: 0.3 }}
        />
      ) : null}
    </div>
  );
}

function WalkArrivalRow({ station }) {
  return (
    <div className="relative" style={{ minHeight: 56 }}>
      <div className="relative flex items-start gap-3">
        <div
          className={`relative z-10 mt-[2px] h-6 ${RAIL_COL} shrink-0 rounded-full border-[3px] border-white bg-slate-500 shadow-md`}
        />
        <div className="flex-1 pb-3">
          <p className="text-sm font-bold text-slate-800">
            {formatStationLabel(station.name)} 도착
          </p>
          {station.arrivalTime && (
            <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-400">
              {station.arrivalTime}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BoardingRow({ leg }) {
  const { boarding, lineColor, lineName } = leg;

  return (
    <div className="relative" style={{ minHeight: 72 }}>
      <div className="relative flex items-start gap-3">
        <div
          className={`relative z-10 mt-[2px] flex h-6 ${RAIL_COL} shrink-0 items-center justify-center rounded-full border-[3px] border-white shadow-md`}
          style={{ backgroundColor: lineColor }}
        >
          <Train className="h-3 w-3 text-white" strokeWidth={2.5} />
        </div>
        <div className="flex-1 pb-3">
          <p className="text-sm font-bold text-slate-800">
            <span style={{ color: lineColor }}>{lineName}</span>{" "}
            {formatStationLabel(boarding.name)} 승차
          </p>
          {boarding.arrivalTime && (
            <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-400">
              {boarding.arrivalTime}
            </p>
          )}
          {boarding.heading && (
            <p className="mt-0.5 text-xs text-slate-500">{boarding.heading}</p>
          )}
          <CongestionChip rate={boarding.congestionRate} />
        </div>
      </div>
    </div>
  );
}

function WaypointRow({ station, lineColor }) {
  return (
    <div className="relative" style={{ minHeight: 36 }}>
      <div className="relative flex items-center gap-3 py-0.5">
        {/* 레일 열(w-6) 안에 노드를 가로 중앙 → 라인 중심과 일치 */}
        <div className={`relative z-10 flex ${RAIL_COL} shrink-0 items-center justify-center`}>
          <div
            className="h-3.5 w-3.5 rounded-full border-2 bg-white"
            style={{ borderColor: lineColor }}
          />
        </div>
        <span className="text-sm text-slate-600">
          {formatStationLabel(station.name)}
        </span>
      </div>
    </div>
  );
}

function AlightingRow({ leg }) {
  const { alighting, lineColor, isLast } = leg;
  const label = isLast ? "도착" : "하차";

  return (
    <div className="relative" style={{ minHeight: 56 }}>
      <div className="relative flex items-start gap-3">
        <div
          className={`relative z-10 mt-[2px] h-6 ${RAIL_COL} shrink-0 rounded-full border-[3px] border-white shadow-md`}
          style={{ backgroundColor: lineColor }}
        />
        <div className="flex-1 pb-3">
          <p className="text-sm font-bold text-slate-800">
            {formatStationLabel(alighting.name)} {label}
          </p>
          {alighting.arrivalTime && (
            <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-400">
              {alighting.arrivalTime}
            </p>
          )}
          <CongestionChip rate={alighting.congestionRate} />
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
        className={`absolute ${RAIL_LINE_LEFT} top-[14px] w-[4px]`}
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
            leg.waypoints.map((wp) => (
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
  const lastLeg = legs[legs.length - 1];
  const walkDest = lastLeg?.walkDestination;

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
      {walkDest && (
        <>
          <WalkConnector
            prevColor={lastLeg.lineColor}
            nextColor={null}
            minutes={lastLeg.walkAfterMinutes}
            label="도보"
          />
          <WalkArrivalRow station={walkDest} />
        </>
      )}
    </div>
  );
}
