import React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { CROWD_COLORS, CROWD_LABELS } from "@/lib/congestion";
import { getLineEndBadges } from "@/lib/metro-line-badges";
import {
  MAP_VIEWBOX,
  METRO_LINE_SEGMENTS,
  getSegmentCrowdLevel,
  getLineKeyForColor,
  getUniqueLineLegend,
  getStationsForMapStyle,
  segmentMatchesLine,
  washLineColor,
  normalizeLineColor,
} from "@/lib/metro-network";
import { sameStation } from "@/lib/station-id";
import { formatStationLabel } from "@/lib/station-name";
import { TransferStationMarker } from "@/components/TransferStationMarker";
import { isSeoulMetroStation, SEOUL_LINE_PATTERN } from "@/lib/seoul-metro-stations";
import {
  BASE_STATION_R,
  STATION_META,
  getLabelLayout,
  getLabelLayoutsForStations,
  getStationMeta,
} from "@/lib/metro-label-layout";
import {
  busyLevelColor,
  getDemoBusyStationLevel,
} from "@/lib/map-busy-stations";
import { getMapStylePreset } from "@/lib/map-style-presets";
const MIN_SCALE = 0.35;
const MAX_SCALE = 4;
const { width: VB_W, height: VB_H } = MAP_VIEWBOX;

/**
 * @param {object} props
 * @param {'off'|'nodes'|'labelBg'|'rings'|'halo'|'busyLabels'} [props.busyHighlightMode]
 *   보통 초과 역만 가볍게 강조 (시안 비교용). off면 기존 구간 오버레이만.
 * @param {boolean} [props.showLineCongestion] 구간 혼잡 오버레이 (기본 true)
 * @param {boolean} [props.forceShowLabels] 줌과 무관하게 역명 표시
 * @param {string} [props.mapHeightClass] 지도 영역 높이 클래스
 * @param {import('@/lib/map-style-presets').MapStyleId} [props.mapStyle] 노선도 표현 시안
 */
function InteractiveMetroMap({
  selectedTime = "18:30",
  departureStationId,
  destinationStationId,
  pickRole,
  onStationClick,
  seoulOnly = false,
  highlightedLineKeys = null,
  highlightedStationIds = null,
  routeHighlightOnly = false,
  hideLegendChips = false,
  focusStationId = null,
  busyHighlightMode = "off",
  showLineCongestion = true,
  forceShowLabels = false,
  mapHeightClass = "h-[min(62vh,460px)]",
  mapStyle = "baseline",
}) {
  const preset = getMapStylePreset(mapStyle);
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.85 });
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });
  const styledStations = useMemo(
    () => getStationsForMapStyle({ compactCenter: preset.compactCenter }),
    [preset.compactCenter],
  );
  const labelLayouts = useMemo(() => {
    if (preset.labelMode === "classic" && !preset.compactCenter) {
      return null;
    }
    return getLabelLayoutsForStations(
      STATION_META,
      styledStations,
      preset.labelMode,
      `${preset.id}:${preset.labelMode}:${preset.compactCenter}`,
    );
  }, [preset, styledStations]);
  const resolveLabel = useCallback(
    (stationId) => {
      if (labelLayouts) {
        return (
          labelLayouts.get(stationId) ?? {
            x: 0,
            y: 0,
            anchor: "start",
            rotate: 0,
          }
        );
      }
      return getLabelLayout(stationId);
    },
    [labelLayouts],
  );
  const lineLegend = useMemo(() => {
    const all = getUniqueLineLegend();
    if (!seoulOnly) return all;
    return all.filter((line) => SEOUL_LINE_PATTERN.test(line.lineKey));
  }, [seoulOnly]);
  const visibleStations = useMemo(
    () =>
      seoulOnly
        ? styledStations.filter((s) => isSeoulMetroStation(s.name))
        : styledStations,
    [seoulOnly, styledStations],
  );
  const visibleLineSegments = useMemo(
    () =>
      seoulOnly
        ? METRO_LINE_SEGMENTS.filter((seg) =>
            SEOUL_LINE_PATTERN.test(getLineKeyForColor(seg.color)),
          )
        : METRO_LINE_SEGMENTS,
    [seoulOnly],
  );
  const [focusedLineKey, setFocusedLineKey] = useState(null);
  const isLineFocused = useCallback(
    (lineKey) => {
      if (routeHighlightOnly && highlightedLineKeys?.length) {
        return highlightedLineKeys.includes(lineKey);
      }
      return !focusedLineKey || focusedLineKey === lineKey;
    },
    [focusedLineKey, highlightedLineKeys, routeHighlightOnly],
  );
  const stationOnFocusedLine = useCallback(
    (lineKeys, lineColor) => {
      if (routeHighlightOnly && highlightedLineKeys?.length) {
        if (lineKeys.some((k) => highlightedLineKeys.includes(k))) return true;
        return highlightedLineKeys.includes(getLineKeyForColor(lineColor));
      }
      if (!focusedLineKey) return true;
      if (lineKeys.includes(focusedLineKey)) return true;
      return getLineKeyForColor(lineColor) === focusedLineKey;
    },
    [focusedLineKey, highlightedLineKeys, routeHighlightOnly],
  );
  const congestionSegments = useMemo(
    () =>
      showLineCongestion
        ? visibleLineSegments
            .map((seg) => ({
              ...seg,
              level: getSegmentCrowdLevel(seg, selectedTime),
            }))
            .filter((s) => s.level)
        : [],
    [selectedTime, visibleLineSegments, showLineCongestion],
  );
  const busyByStationId = useMemo(() => {
    if (!busyHighlightMode || busyHighlightMode === "off") return null;
    /** @type {Map<string, string>} */
    const map = new Map();
    for (const st of visibleStations) {
      const level = getDemoBusyStationLevel(st);
      if (level) map.set(st.id, level);
    }
    return map;
  }, [busyHighlightMode, visibleStations]);
  const zoom = useCallback((factor, centerX, centerY) => {
    setTransform((prev) => {
      const el = containerRef.current;
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, prev.scale * factor),
      );
      if (!el) return { ...prev, scale: next };
      const rect = el.getBoundingClientRect();
      const cx =
        centerX !== undefined ? centerX - rect.left : rect.width / 2;
      const cy =
        centerY !== undefined ? centerY - rect.top : rect.height / 2;
      const ratio = next / prev.scale;
      return {
        scale: next,
        x: cx - (cx - prev.x) * ratio,
        y: cy - (cy - prev.y) * ratio,
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
      scale,
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
      origY: transform.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    setTransform((prev) => ({
      ...prev,
      x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
    }));
  };
  const onPointerUp = () => {
    dragRef.current.active = false;
  };
  useEffect(() => {
    if (!focusStationId || !containerRef.current) return;
    const target = visibleStations.find((s) => s.id === focusStationId);
    if (!target) return;
    const el = containerRef.current;
    const w = el.clientWidth;
    const h = el.clientHeight;
    setTransform((prev) => ({
      ...prev,
      x: w / 2 - target.x * prev.scale,
      y: h / 2 - target.y * prev.scale,
    }));
  }, [focusStationId, visibleStations]);
  const showLabels =
    forceShowLabels ||
    busyHighlightMode === "labelBg" ||
    busyHighlightMode === "busyLabels" ||
    transform.scale >= 0.95;
  const transferOnlyLabels =
    !forceShowLabels &&
    preset.transferOnlyLabelsBelowScale != null &&
    transform.scale < preset.transferOnlyLabelsBelowScale;
  return /* @__PURE__ */ React.createElement(
    "div",
    { className: "relative" },
    !hideLegendChips &&
      /* @__PURE__ */ React.createElement(
        "div",
        { className: "mb-2 max-h-16 overflow-y-auto px-1" },
        /* @__PURE__ */ React.createElement(
          "div",
          { className: "flex flex-wrap gap-x-1.5 gap-y-1" },
          /* @__PURE__ */ React.createElement(
            "button",
            {
              type: "button",
              onClick: () => !routeHighlightOnly && setFocusedLineKey(null),
              className: `rounded-full px-2 py-0.5 text-[9px] transition-colors ${focusedLineKey === null ? "bg-slate-800 text-white" : "bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:bg-slate-50"}`,
            },
            "전체",
          ),
          lineLegend.map((line) => {
            const active = focusedLineKey === line.lineKey;
            return /* @__PURE__ */ React.createElement(
              "button",
              {
                key: line.lineKey,
                type: "button",
                onClick: () =>
                  !routeHighlightOnly &&
                  setFocusedLineKey((prev) =>
                    prev === line.lineKey ? null : line.lineKey,
                  ),
                className: `flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] transition-all ${active ? "bg-white text-slate-800 shadow-[0_0_0_2px_var(--line-color)]" : focusedLineKey ? "bg-white/60 text-slate-400 hover:bg-white hover:text-slate-600" : "bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:bg-slate-50"}`,
                style: { "--line-color": line.color },
              },
              /* @__PURE__ */ React.createElement("span", {
                className: "h-1.5 w-3 rounded-full",
                style: {
                  backgroundColor: line.color,
                  opacity: active || !focusedLineKey ? 1 : 0.45,
                },
              }),
              line.name,
            );
          }),
        ),
      ),
    /* @__PURE__ */ React.createElement(
      "div",
      { className: "relative" },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          ref: containerRef,
          className: `${mapHeightClass} relative w-full cursor-grab overflow-hidden rounded-2xl bg-[#fafbfc] shadow-[inset_0_1px_4px_rgba(15,23,42,0.04)] active:cursor-grabbing`,
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerLeave: onPointerUp,
        },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
            width: VB_W,
            height: VB_H,
          },
        },
        /* @__PURE__ */ React.createElement(
          "svg",
          {
            viewBox: `0 0 ${VB_W} ${VB_H}`,
            width: VB_W,
            height: VB_H,
            className: "select-none",
          },
          /* @__PURE__ */ React.createElement(
            "g",
            { className: "transition-opacity duration-300" },
            visibleLineSegments.map((seg) => {
              const focused = routeHighlightOnly
                ? highlightedLineKeys?.includes(getLineKeyForColor(seg.color))
                : segmentMatchesLine(seg, focusedLineKey);
              const baseW = preset.lineStrokeUniform
                ? (preset.uniformStrokeWidth ?? 3.2)
                : (seg.width ?? 3);
              return /* @__PURE__ */ React.createElement("line", {
                key: seg.id,
                x1: seg.x1,
                y1: seg.y1,
                x2: seg.x2,
                y2: seg.y2,
                stroke: focused
                  ? normalizeLineColor(seg.color)
                  : washLineColor(normalizeLineColor(seg.color)),
                strokeWidth:
                  focused && focusedLineKey ? baseW + 0.8 : baseW,
                strokeLinecap: "round",
                opacity: focused ? 1 : 0.2,
                className: "transition-all duration-300",
              });
            }),
          ),
          /* @__PURE__ */ React.createElement(
            "g",
            { className: "transition-opacity duration-300" },
            congestionSegments.map((seg) => {
              const focused = routeHighlightOnly
                ? highlightedLineKeys?.includes(getLineKeyForColor(seg.color))
                : segmentMatchesLine(seg, focusedLineKey);
              if (
                (focusedLineKey && !focused) ||
                (routeHighlightOnly && !focused)
              )
                return null;
              return /* @__PURE__ */ React.createElement("line", {
                key: `c-${seg.id}`,
                x1: seg.x1,
                y1: seg.y1,
                x2: seg.x2,
                y2: seg.y2,
                stroke: CROWD_COLORS[seg.level],
                strokeWidth: 6,
                strokeLinecap: "round",
                opacity: focused ? 0.88 : 0.1,
                className: "transition-all duration-500",
              });
            }),
          ),
          showLabels &&
            /* @__PURE__ */ React.createElement(
              "g",
              {
                className:
                  "pointer-events-none transition-opacity duration-300",
              },
              visibleStations.map((station) => {
                const meta = getStationMeta(station);
                const focused = stationOnFocusedLine(
                  meta.lineKeys,
                  meta.lineColor,
                );
                if (transferOnlyLabels && !meta.isTransfer) return null;
                const lbl = resolveLabel(station.id);
                const busyLevel = busyByStationId?.get(station.id) ?? null;
                const busyColor = busyLevelColor(busyLevel);
                const onlyBusyLabels = busyHighlightMode === "busyLabels";
                if (onlyBusyLabels && !busyLevel) return null;
                const useLabelBg =
                  busyColor &&
                  (busyHighlightMode === "labelBg" ||
                    busyHighlightMode === "busyLabels");
                const name = station.name;
                const approxW = Math.max(10, name.length * 3.1);
                const approxH = 6.2;
                const padX = 1.6;
                const rectX =
                  lbl.anchor === "end"
                    ? lbl.x - approxW - padX
                    : lbl.anchor === "middle"
                      ? lbl.x - approxW / 2 - padX / 2
                      : lbl.x - padX;
                const rectY = lbl.y - approxH * 0.72;
                return /* @__PURE__ */ React.createElement(
                  "g",
                  {
                    key: `lbl-${station.id}`,
                    transform: `rotate(${lbl.rotate} ${lbl.x} ${lbl.y})`,
                    opacity: focused || busyLevel ? 1 : 0.35,
                  },
                  useLabelBg &&
                    /* @__PURE__ */ React.createElement("rect", {
                      x: rectX,
                      y: rectY,
                      width: approxW + padX * 2,
                      height: approxH,
                      rx: 1.4,
                      ry: 1.4,
                      fill: busyColor,
                      opacity: 0.92,
                    }),
                  /* @__PURE__ */ React.createElement(
                    "text",
                    {
                      x: lbl.x,
                      y: lbl.y,
                      textAnchor: lbl.anchor,
                      fill: useLabelBg
                        ? "#ffffff"
                        : focused
                          ? "#334155"
                          : "#94a3b8",
                      stroke: useLabelBg ? "none" : "#ffffff",
                      strokeWidth: useLabelBg ? 0 : 2.5,
                      paintOrder: "stroke fill",
                      style: {
                        fontSize: onlyBusyLabels ? 5.2 : 4.8,
                        fontWeight: useLabelBg
                          ? 700
                          : meta.isTransfer
                            ? 600
                            : 400,
                        fontFamily: "system-ui, sans-serif",
                      },
                    },
                    name,
                  ),
                );
              }),
            ),
          /* @__PURE__ */ React.createElement(
            "g",
            {
              className: "pointer-events-none transition-opacity duration-300",
            },
            getLineEndBadges().filter(
              (badge) => !seoulOnly || SEOUL_LINE_PATTERN.test(badge.lineKey),
            ).map((badge) => {
              const focused = isLineFocused(badge.lineKey);
              const br =
                badge.label.length <= 2
                  ? 7
                  : badge.label.length <= 4
                    ? 8.5
                    : 10;
              const fs =
                badge.label.length <= 1
                  ? 6.5
                  : badge.label.length <= 2
                    ? 5.5
                    : 4.2;
              return /* @__PURE__ */ React.createElement(
                "g",
                { key: badge.id, opacity: focused ? 1 : 0.25 },
                /* @__PURE__ */ React.createElement("circle", {
                  cx: badge.x,
                  cy: badge.y,
                  r: br,
                  fill: focused ? normalizeLineColor(badge.color) : washLineColor(normalizeLineColor(badge.color)),
                }),
                /* @__PURE__ */ React.createElement(
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
                      fontFamily: "system-ui, sans-serif",
                    },
                  },
                  badge.label,
                ),
              );
            }),
          ),
          /* @__PURE__ */ React.createElement(
            "g",
            { className: "transition-opacity duration-300" },
            visibleStations.map((station) => {
              const meta = getStationMeta(station);
              const focused = stationOnFocusedLine(
                meta.lineKeys,
                meta.lineColor,
              );
              const isTransfer = meta.isTransfer;
              const markerR = isTransfer ? preset.transferR : preset.regularR;
              const isDep = sameStation(station.id, departureStationId);
              const isDest = sameStation(station.id, destinationStationId);
              const ringR = markerR + 5;
              const stationHighlighted =
                routeHighlightOnly && highlightedStationIds?.length
                  ? highlightedStationIds.includes(station.id)
                  : true;
              const dimOpacity = stationHighlighted
                ? focused
                  ? 1
                  : 0.35
                : 0.12;
              const busyLevel = busyByStationId?.get(station.id) ?? null;
              const busyColor = busyLevelColor(busyLevel);
              const fillNode =
                busyColor && busyHighlightMode === "nodes";
              const showBusyRing =
                busyColor && busyHighlightMode === "rings";
              const showHalo =
                busyColor && busyHighlightMode === "halo";
              const cleanNodes = preset.nodeStyle === "clean";
              return /* @__PURE__ */ React.createElement(
                "g",
                {
                  key: station.id,
                  "data-station": true,
                  className: "cursor-pointer transition-opacity duration-300",
                  opacity: dimOpacity,
                  onClick: (e) => {
                    e.stopPropagation();
                    if (onStationClick) onStationClick(station, pickRole);
                  },
                },
                /* @__PURE__ */ React.createElement(
                  "title",
                  null,
                  busyLevel
                    ? `${formatStationLabel(station.name)} · ${CROWD_LABELS[busyLevel]}`
                    : formatStationLabel(station.name),
                ),
                showHalo &&
                  /* @__PURE__ */ React.createElement(
                    React.Fragment,
                    null,
                    /* @__PURE__ */ React.createElement("circle", {
                      cx: station.x,
                      cy: station.y,
                      r: markerR + 9,
                      fill: busyColor,
                      opacity: 0.12,
                    }),
                    /* @__PURE__ */ React.createElement("circle", {
                      cx: station.x,
                      cy: station.y,
                      r: markerR + 5.5,
                      fill: busyColor,
                      opacity: 0.22,
                    }),
                  ),
                showBusyRing &&
                  /* @__PURE__ */ React.createElement("circle", {
                    cx: station.x,
                    cy: station.y,
                    r: markerR + 3.5,
                    fill: "none",
                    stroke: busyColor,
                    strokeWidth: 2.4,
                  }),
                isDep &&
                  /* @__PURE__ */ React.createElement("circle", {
                    cx: station.x,
                    cy: station.y,
                    r: ringR,
                    fill: "none",
                    stroke: "#16a34a",
                    strokeWidth: 2,
                  }),
                isDest &&
                  /* @__PURE__ */ React.createElement("circle", {
                    cx: station.x,
                    cy: station.y,
                    r: ringR,
                    fill: "none",
                    stroke: "#e11d48",
                    strokeWidth: 2,
                  }),
                isTransfer
                  ? /* @__PURE__ */ React.createElement(
                      React.Fragment,
                      null,
                      /* @__PURE__ */ React.createElement(TransferStationMarker, {
                        x: station.x,
                        y: station.y,
                        r: preset.transferR,
                        strokeWidth: preset.transferStroke,
                      }),
                      fillNode &&
                        /* @__PURE__ */ React.createElement("circle", {
                          cx: station.x,
                          cy: station.y,
                          r: Math.max(2.5, preset.regularR + 0.8),
                          fill: busyColor,
                          opacity: 0.85,
                        }),
                    )
                  : /* @__PURE__ */ React.createElement("circle", {
                      cx: station.x,
                      cy: station.y,
                      r: cleanNodes ? preset.regularR : BASE_STATION_R,
                      fill: fillNode ? busyColor : "#ffffff",
                      stroke: fillNode
                        ? "#ffffff"
                        : focused
                          ? normalizeLineColor(meta.lineColor)
                          : washLineColor(normalizeLineColor(meta.lineColor)),
                      strokeWidth: fillNode
                        ? 1.4
                        : cleanNodes
                          ? 1.6
                          : 2.2,
                    }),
              );
            }),
          ),
        ),
      ),
      ),
      /* @__PURE__ */ React.createElement(
        "div",
        {
          className:
            "pointer-events-none absolute right-3 top-3 z-30 flex flex-col gap-1.5",
        },
        [
          {
            icon: Plus,
            fn: () => {
              const el = containerRef.current;
              if (!el) return zoom(1.25);
              const rect = el.getBoundingClientRect();
              zoom(1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
            },
          },
          {
            icon: Minus,
            fn: () => {
              const el = containerRef.current;
              if (!el) return zoom(0.8);
              const rect = el.getBoundingClientRect();
              zoom(0.8, rect.left + rect.width / 2, rect.top + rect.height / 2);
            },
          },
          { icon: Maximize2, fn: resetView },
        ].map(({ icon: Icon, fn }, i) =>
          /* @__PURE__ */ React.createElement(
            "button",
            {
              key: i,
              type: "button",
              onClick: (e) => {
                e.stopPropagation();
                fn();
              },
              onPointerDown: (e) => {
                e.stopPropagation();
                e.preventDefault();
              },
              className:
                "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 shadow-[0_1px_4px_rgba(15,23,42,0.12)] hover:bg-slate-50 active:scale-95",
            },
            /* @__PURE__ */ React.createElement(Icon, { className: "h-4 w-4" }),
          ),
        ),
      ),
    ),
    /* @__PURE__ */ React.createElement(
      "div",
      { className: "mt-2 flex flex-wrap items-center justify-between gap-2" },
      /* @__PURE__ */ React.createElement(
        "p",
        { className: "text-[10px] text-slate-400" },
        busyHighlightMode && busyHighlightMode !== "off"
          ? "보통 초과 역만 강조 · 상단 호선 클릭 시 강조"
          : "노선 색: 열차 구간 혼잡도 · 상단 호선 클릭 시 강조",
      ),
      /* @__PURE__ */ React.createElement(
        "div",
        { className: "flex gap-2" },
        (busyHighlightMode && busyHighlightMode !== "off"
          ? ["BUSY", "VERY_BUSY", "EXTREME"]
          : ["RELAXED", "NORMAL", "BUSY", "VERY_BUSY"]
        ).map((l) =>
          /* @__PURE__ */ React.createElement(
            "span",
            {
              key: l,
              className: "flex items-center gap-1 text-[9px] text-slate-500",
            },
            /* @__PURE__ */ React.createElement("span", {
              className: "h-1.5 w-1.5 rounded-full",
              style: { backgroundColor: CROWD_COLORS[l] },
            }),
            CROWD_LABELS[l],
          ),
        ),
      ),
    ),
  );
}
export { InteractiveMetroMap };
