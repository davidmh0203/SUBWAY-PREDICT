import React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { CROWD_COLORS, CROWD_LABELS } from "@/lib/congestion";
import { LINE_END_BADGES } from "@/lib/metro-line-badges";
import {
  MAP_VIEWBOX,
  METRO_LINE_SEGMENTS,
  METRO_STATIONS,
  getSegmentCrowdLevel,
  getLineKeyForColor,
  getUniqueLineLegend,
  segmentMatchesLine,
  washLineColor
} from "@/lib/metro-network";
import { TransferStationMarker } from "@/components/TransferStationMarker";
import { isSeoulMetroStation } from "@/lib/seoul-metro-stations";
import {
  BASE_STATION_R,
  getLabelLayout,
  getStationMarkerRadius,
  getStationMeta
} from "@/lib/metro-label-layout";
const MIN_SCALE = 0.35;
const MAX_SCALE = 4;
const { width: VB_W, height: VB_H } = MAP_VIEWBOX;
const SEOUL_LINE_PATTERN = /^[1-9]호선/;
function InteractiveMetroMap({
  selectedTime = "18:30",
  departureStationId,
  destinationStationId,
  pickRole,
  onStationClick,
  seoulOnly = false,
  stationCongestionSnapshot = [],
}) {
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.85 });
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0
  });
  const lineLegend = useMemo(() => {
    const all = getUniqueLineLegend();
    if (!seoulOnly) return all;
    return all.filter((line) => SEOUL_LINE_PATTERN.test(line.lineKey));
  }, [seoulOnly]);
  const visibleStations = useMemo(
    () => (seoulOnly ? METRO_STATIONS.filter((s) => isSeoulMetroStation(s.name)) : METRO_STATIONS),
    [seoulOnly],
  );
  const visibleLineSegments = useMemo(
    () =>
      seoulOnly
        ? METRO_LINE_SEGMENTS.filter((seg) => SEOUL_LINE_PATTERN.test(getLineKeyForColor(seg.color)))
        : METRO_LINE_SEGMENTS,
    [seoulOnly],
  );
  const [focusedLineKey, setFocusedLineKey] = useState(null);
  const stationCongestionById = useMemo(() => {
    const map = new Map();
    for (const row of stationCongestionSnapshot) {
      map.set(row.stationId, row);
    }
    return map;
  }, [stationCongestionSnapshot]);
  const isLineFocused = useCallback(
    (lineKey) => !focusedLineKey || focusedLineKey === lineKey,
    [focusedLineKey]
  );
  const stationOnFocusedLine = useCallback(
    (lineKeys, lineColor) => {
      if (!focusedLineKey) return true;
      if (lineKeys.includes(focusedLineKey)) return true;
      return getLineKeyForColor(lineColor) === focusedLineKey;
    },
    [focusedLineKey]
  );
  const congestionSegments = useMemo(
    () =>
      visibleLineSegments
        .map((seg) => ({
          ...seg,
          level: getSegmentCrowdLevel(seg, selectedTime),
        }))
        .filter((s) => s.level),
    [selectedTime, visibleLineSegments],
  );
  const zoom = useCallback((factor, centerX, centerY) => {
    setTransform((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
      if (centerX === void 0 || !containerRef.current) {
        return { ...prev, scale: next };
      }
      const rect = containerRef.current.getBoundingClientRect();
      const cx = centerX - rect.left;
      const cy = (centerY ?? 0) - rect.top;
      const ratio = next / prev.scale;
      return {
        scale: next,
        x: cx - (cx - prev.x) * ratio,
        y: cy - (cy - prev.y) * ratio
      };
    });
  }, []);
  const resetView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const scale = Math.min(w / VB_W, h / VB_H) * 0.98;
    setTransform({
      x: (w - VB_W * scale) / 2,
      y: (h - VB_H * scale) / 2,
      scale
    });
  }, []);
  useEffect(() => {
    resetView();
  }, [resetView]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 0.9 : 1.1, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom]);
  const onPointerDown = (e) => {
    if (e.target.closest("[data-station]")) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: transform.x,
      origY: transform.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    setTransform((prev) => ({
      ...prev,
      x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.origY + (e.clientY - dragRef.current.startY)
    }));
  };
  const onPointerUp = () => {
    dragRef.current.active = false;
  };
  const showLabels = transform.scale >= 0.95;
  return /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement("div", { className: "mb-2 max-h-16 overflow-y-auto px-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-x-1.5 gap-y-1" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => setFocusedLineKey(null),
      className: `rounded-full px-2 py-0.5 text-[9px] transition-colors ${focusedLineKey === null ? "bg-slate-800 text-white" : "bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:bg-slate-50"}`
    },
    "전체"
  ), lineLegend.map((line) => {
    const active = focusedLineKey === line.lineKey;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: line.lineKey,
        type: "button",
        onClick: () => setFocusedLineKey((prev) => prev === line.lineKey ? null : line.lineKey),
        className: `flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] transition-all ${active ? "bg-white text-slate-800 shadow-[0_0_0_2px_var(--line-color)]" : focusedLineKey ? "bg-white/60 text-slate-400 hover:bg-white hover:text-slate-600" : "bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:bg-slate-50"}`,
        style: { "--line-color": line.color }
      },
      /* @__PURE__ */ React.createElement(
        "span",
        {
          className: "h-1.5 w-3 rounded-full",
          style: { backgroundColor: line.color, opacity: active || !focusedLineKey ? 1 : 0.45 }
        }
      ),
      line.name
    );
  }))), /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: containerRef,
      className: "relative h-[min(62vh,460px)] w-full cursor-grab overflow-hidden rounded-2xl bg-[#fafbfc] shadow-[inset_0_1px_4px_rgba(15,23,42,0.04)] active:cursor-grabbing",
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave: onPointerUp
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          width: VB_W,
          height: VB_H
        }
      },
      /* @__PURE__ */ React.createElement(
        "svg",
        {
          viewBox: `0 0 ${VB_W} ${VB_H}`,
          width: VB_W,
          height: VB_H,
          className: "select-none"
        },
        /* @__PURE__ */ React.createElement("g", { className: "transition-opacity duration-300" }, visibleLineSegments.map((seg) => {
          const focused = segmentMatchesLine(seg, focusedLineKey);
          return /* @__PURE__ */ React.createElement(
            "line",
            {
              key: seg.id,
              x1: seg.x1,
              y1: seg.y1,
              x2: seg.x2,
              y2: seg.y2,
              stroke: focused ? seg.color : washLineColor(seg.color),
              strokeWidth: focused && focusedLineKey ? (seg.width ?? 3) + 0.8 : seg.width ?? 3,
              strokeLinecap: "round",
              opacity: focused ? 1 : 0.55,
              className: "transition-all duration-300"
            }
          );
        })),
        /* @__PURE__ */ React.createElement("g", { className: "transition-opacity duration-300" }, congestionSegments.map((seg) => {
          const focused = segmentMatchesLine(seg, focusedLineKey);
          if (focusedLineKey && !focused) return null;
          return /* @__PURE__ */ React.createElement(
            "line",
            {
              key: `c-${seg.id}`,
              x1: seg.x1,
              y1: seg.y1,
              x2: seg.x2,
              y2: seg.y2,
              stroke: CROWD_COLORS[seg.level],
              strokeWidth: 6,
              strokeLinecap: "round",
              opacity: focused ? 0.8 : 0.35,
              className: "transition-all duration-500"
            }
          );
        })),
        showLabels && /* @__PURE__ */ React.createElement("g", { className: "pointer-events-none transition-opacity duration-300" }, visibleStations.map((station) => {
          const meta = getStationMeta(station);
          const focused = stationOnFocusedLine(meta.lineKeys, meta.lineColor);
          const lbl = getLabelLayout(station.id);
          return /* @__PURE__ */ React.createElement(
            "text",
            {
              key: `lbl-${station.id}`,
              x: lbl.x,
              y: lbl.y,
              textAnchor: lbl.anchor,
              transform: `rotate(${lbl.rotate} ${lbl.x} ${lbl.y})`,
              fill: focused ? "#334155" : "#94a3b8",
              stroke: "#ffffff",
              strokeWidth: 2.5,
              paintOrder: "stroke fill",
              opacity: focused ? 1 : 0.35,
              style: { fontSize: 4.8, fontFamily: "system-ui, sans-serif" }
            },
            station.name
          );
        })),
        /* @__PURE__ */ React.createElement("g", { className: "pointer-events-none transition-opacity duration-300" }, LINE_END_BADGES.filter((badge) => !seoulOnly || SEOUL_LINE_PATTERN.test(badge.lineKey)).map((badge) => {
          const focused = isLineFocused(badge.lineKey);
          const br = badge.label.length <= 2 ? 7 : badge.label.length <= 4 ? 8.5 : 10;
          const fs = badge.label.length <= 1 ? 6.5 : badge.label.length <= 2 ? 5.5 : 4.2;
          return /* @__PURE__ */ React.createElement("g", { key: badge.id, opacity: focused ? 1 : 0.25 }, /* @__PURE__ */ React.createElement(
            "circle",
            {
              cx: badge.x,
              cy: badge.y,
              r: br,
              fill: focused ? badge.color : washLineColor(badge.color)
            }
          ), /* @__PURE__ */ React.createElement(
            "text",
            {
              x: badge.x,
              y: badge.y + 0.5,
              textAnchor: "middle",
              dominantBaseline: "middle",
              fill: "#ffffff",
              style: {
                fontSize: fs,
                fontWeight: 700,
                fontFamily: "system-ui, sans-serif"
              }
            },
            badge.label
          ));
        })),
        /* @__PURE__ */ React.createElement("g", { className: "transition-opacity duration-300" }, visibleStations.map((station) => {
          const meta = getStationMeta(station);
          const focused = stationOnFocusedLine(meta.lineKeys, meta.lineColor);
          const isTransfer = meta.isTransfer;
          const markerR = getStationMarkerRadius(meta);
          const isDep = station.id === departureStationId;
          const isDest = station.id === destinationStationId;
          const stationCong = stationCongestionById.get(station.id);
          const congColor = stationCong ? CROWD_COLORS[stationCong.stationLevel] : null;
          const ringR = markerR + 5;
          const dimOpacity = focused ? 1 : 0.3;
          return /* @__PURE__ */ React.createElement(
            "g",
            {
              key: station.id,
              "data-station": true,
              className: "cursor-pointer transition-opacity duration-300",
              opacity: dimOpacity,
              onClick: (e) => {
                e.stopPropagation();
                onStationClick(station, pickRole);
              }
            },
            isDep && /* @__PURE__ */ React.createElement(
              "circle",
              {
                cx: station.x,
                cy: station.y,
                r: ringR,
                fill: "none",
                stroke: "#16a34a",
                strokeWidth: 2
              }
            ),
            isDest && /* @__PURE__ */ React.createElement(
              "circle",
              {
                cx: station.x,
                cy: station.y,
                r: ringR,
                fill: "none",
                stroke: "#e11d48",
                strokeWidth: 2
              }
            ),
            isTransfer ? /* @__PURE__ */ React.createElement(
              "g",
              null,
              congColor && /* @__PURE__ */ React.createElement("circle", {
                cx: station.x,
                cy: station.y,
                r: markerR + 2.2,
                fill: "none",
                stroke: congColor,
                strokeWidth: 2,
                opacity: 0.9
              }),
              /* @__PURE__ */ React.createElement(TransferStationMarker, { x: station.x, y: station.y })
            ) : /* @__PURE__ */ React.createElement(
              "circle",
              {
                cx: station.x,
                cy: station.y,
                r: BASE_STATION_R,
                fill: congColor ?? "#ffffff",
                stroke: focused ? meta.lineColor : washLineColor(meta.lineColor),
                strokeWidth: 2.2
              }
            )
          );
        }))
      )
    ),
    /* @__PURE__ */ React.createElement("div", { className: "absolute right-3 top-3 flex flex-col gap-1.5" }, [
      { icon: Plus, fn: () => zoom(1.25) },
      { icon: Minus, fn: () => zoom(0.8) },
      { icon: Maximize2, fn: resetView }
    ].map(({ icon: Icon, fn }, i) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: i,
        type: "button",
        onClick: (e) => {
          e.stopPropagation();
          fn();
        },
        className: "flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 shadow-[0_1px_4px_rgba(15,23,42,0.12)] hover:bg-slate-50"
      },
      /* @__PURE__ */ React.createElement(Icon, { className: "h-4 w-4" })
    )))
  ), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex flex-wrap items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("p", { className: "text-[10px] text-slate-400" }, "선: 열차 혼잡도 · 점: 역 혼잡도 · 상단 호선 클릭 시 강조"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, ["RELAXED", "NORMAL", "BUSY", "VERY_BUSY"].map((l) => /* @__PURE__ */ React.createElement("span", { key: l, className: "flex items-center gap-1 text-[9px] text-slate-500" }, /* @__PURE__ */ React.createElement("span", { className: "h-1.5 w-1.5 rounded-full", style: { backgroundColor: CROWD_COLORS[l] } }), CROWD_LABELS[l])))));
}
export {
  InteractiveMetroMap
};
