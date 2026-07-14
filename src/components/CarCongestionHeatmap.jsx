/**
 * 칸별 혼잡 히트맵 (미사용).
 * 제품 정책: 칸별 데이터 없음 → UI 미연동. 열차별(구간) 혼잡도는 route.trainSegments 유지.
 */
import React from "react";
import { CongestionLegend, CrowdBlock } from "@/components/CongestionLegend";
import { formatDepartureLabel } from "@/lib/congestion";
function CarCongestionHeatmap({
  rows,
  departureTime,
  lineColor = "#8a9a5b"
}) {
  const today = /* @__PURE__ */ new Date();
  const dateRange = `20${today.getFullYear() - 2e3}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}.`;
  return /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "text-sm font-bold text-slate-900" }, "[시간대별 경로 혼잡도]"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500" }, dateRange, " ~ ", dateRange), /* @__PURE__ */ React.createElement("p", { className: "mt-2 text-lg font-bold text-slate-900" }, formatDepartureLabel(departureTime))), /* @__PURE__ */ React.createElement(CongestionLegend, { compact: true })), /* @__PURE__ */ React.createElement("div", { className: "flex gap-0" }, /* @__PURE__ */ React.createElement("div", { className: "relative w-24 shrink-0 pt-1" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "absolute left-[18px] top-3 bottom-3 w-[3px] rounded-full",
      style: { backgroundColor: lineColor }
    }
  ), rows.map((row, i) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: row.stationName,
      className: "relative flex h-9 items-center",
      style: { marginBottom: i < rows.length - 1 ? 2 : 0 }
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "absolute left-[14px] z-10 h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm",
        style: { backgroundColor: lineColor }
      }
    ),
    /* @__PURE__ */ React.createElement("span", { className: "ml-7 truncate text-[11px] font-medium text-slate-700" }, row.stationName)
  ))), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1 overflow-x-auto" }, /* @__PURE__ */ React.createElement("div", { className: "mb-1 flex gap-[3px] pl-0.5" }, Array.from({ length: 8 }, (_, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "w-7 shrink-0 text-center text-[9px] text-slate-400" }, i + 1))), rows.map((row) => /* @__PURE__ */ React.createElement("div", { key: row.stationName, className: "mb-[2px] flex gap-[3px]" }, row.cars.map((level, carIdx) => /* @__PURE__ */ React.createElement(
    CrowdBlock,
    {
      key: carIdx,
      level,
      label: carIdx + 1,
      className: "h-9 w-7 shrink-0"
    }
  )))))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 text-[10px] text-slate-400" }, /* @__PURE__ */ React.createElement("span", { className: "inline-block h-2 w-2 rounded-full", style: { backgroundColor: lineColor } }), "2호선 외선순환 · 칸 번호 1(선두) ~ 8(후미)"));
}
export {
  CarCongestionHeatmap
};
