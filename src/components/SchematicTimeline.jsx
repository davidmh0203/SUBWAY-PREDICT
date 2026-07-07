import React from "react";
import { Badge } from "@/components/ui/badge";
import { CONGESTION_STYLES } from "@/lib/congestion";
const NODE_LABELS = {
  신도림: "출발",
  신림: "주의",
  사당: "위험",
  강남: "도착"
};
function SchematicTimeline({ predictions }) {
  return /* @__PURE__ */ React.createElement("div", { className: "relative pl-2" }, predictions.map((node, i) => {
    const style = CONGESTION_STYLES[node.status];
    const isLast = i === predictions.length - 1;
    const showAlternative = node.trigger === "KOPIS_EVENT" || node.congestionRate >= 120;
    const tag = NODE_LABELS[node.stationName] ?? "경유";
    return /* @__PURE__ */ React.createElement("div", { key: node.stationId, className: "relative pb-0", style: { minHeight: 100 } }, !isLast && /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `absolute left-[11px] top-8 h-[calc(100%-8px)] ${style.width} ${style.border} transition-all duration-500`
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "relative flex gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "relative z-10 mt-1 flex flex-col items-center" }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `h-6 w-6 rounded-full border-2 border-white ${style.dot} shadow-[0_1px_4px_rgba(15,23,42,0.15)] transition-all duration-500`
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "flex-1 pb-8" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement(Badge, { variant: node.status === "SMOOTH" ? "smooth" : node.status === "WARNING" ? "warning" : "danger" }, style.emoji, " [", tag, "]"), /* @__PURE__ */ React.createElement("span", { className: "font-semibold text-slate-800" }, node.stationName, "역"), i === 0 && /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400" }, "(2호선 외선순환 탑승)"), /* @__PURE__ */ React.createElement("span", { className: "ml-auto text-sm tabular-nums text-slate-400" }, node.arrivalTime)), /* @__PURE__ */ React.createElement("p", { className: "mt-2 text-sm text-slate-500" }, "예측 구간 혼잡도 ", node.congestionRate, "%", node.status === "SMOOTH" && " — 쾌적하게 착석 가능", node.status === "WARNING" && " — 승객 유입 급증", node.status === "DANGER" && " — 대형 콘서트 영향 퇴장군"), showAlternative && /* @__PURE__ */ React.createElement("div", { className: "mt-3 rounded-xl bg-slate-50 p-4 shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)]" }, /* @__PURE__ */ React.createElement("p", { className: "mb-1 text-xs font-medium text-slate-500" }, "대안 안내"), /* @__PURE__ */ React.createElement("p", { className: "text-sm leading-relaxed text-slate-700" }, node.stationName, "역에서 하차 후 4분 뒤에 오는 다음 열차를 탑승하시면 내부 혼잡도가 ", /* @__PURE__ */ React.createElement("strong", { className: "text-emerald-700" }, "40% 감소"), "합니다.")))));
  }));
}
export {
  SchematicTimeline
};
