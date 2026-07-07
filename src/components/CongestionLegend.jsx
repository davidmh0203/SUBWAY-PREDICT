import React from "react";
import { CROWD_COLORS, CROWD_LABELS } from "@/lib/congestion";
import { User } from "lucide-react";
const LEVELS = ["RELAXED", "NORMAL", "BUSY", "VERY_BUSY"];
const ICON_COUNTS = [1, 2, 3, 4];
function CongestionLegend({ className = "", compact = false }) {
  return /* @__PURE__ */ React.createElement("div", { className: `flex flex-col items-end gap-1.5 ${className}` }, /* @__PURE__ */ React.createElement("div", { className: "flex h-2.5 w-48 overflow-hidden rounded-full" }, LEVELS.map((level) => /* @__PURE__ */ React.createElement("div", { key: level, className: "flex-1", style: { backgroundColor: CROWD_COLORS[level] } }))), !compact && /* @__PURE__ */ React.createElement("div", { className: "flex w-48 justify-between" }, LEVELS.map((level, i) => /* @__PURE__ */ React.createElement("div", { key: level, className: "flex flex-col items-center gap-0.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex -space-x-0.5" }, Array.from({ length: ICON_COUNTS[i] }).map((_, j) => /* @__PURE__ */ React.createElement(
    User,
    {
      key: j,
      className: "h-3 w-3",
      style: { color: CROWD_COLORS[level] },
      fill: CROWD_COLORS[level],
      strokeWidth: 0
    }
  ))), /* @__PURE__ */ React.createElement("span", { className: "text-[9px] text-slate-500" }, CROWD_LABELS[level])))));
}
function CrowdBlock({
  level,
  label,
  className = ""
}) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: `flex items-center justify-center rounded-md text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-300 ${className}`,
      style: { backgroundColor: CROWD_COLORS[level] }
    },
    label
  );
}
export {
  CongestionLegend,
  CrowdBlock
};
