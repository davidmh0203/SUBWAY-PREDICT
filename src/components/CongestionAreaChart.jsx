import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { CONGESTION_STYLES } from "@/lib/congestion";
function statusColor(status) {
  if (status === "DANGER") return "#f43f5e";
  if (status === "WARNING") return "#f59e0b";
  return "#10b981";
}
function CongestionAreaChart({ data, activeTime }) {
  const activeIndex = data.findIndex((d) => d.time === activeTime);
  return /* @__PURE__ */ React.createElement("div", { className: "h-28 w-full" }, /* @__PURE__ */ React.createElement(ResponsiveContainer, { width: "100%", height: "100%" }, /* @__PURE__ */ React.createElement(AreaChart, { data, margin: { top: 4, right: 4, left: -20, bottom: 0 } }, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: "painGradient", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ React.createElement("stop", { offset: "5%", stopColor: "#f43f5e", stopOpacity: 0.15 }), /* @__PURE__ */ React.createElement("stop", { offset: "95%", stopColor: "#10b981", stopOpacity: 0.03 }))), /* @__PURE__ */ React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "#e2e8f0", vertical: false }), /* @__PURE__ */ React.createElement(XAxis, { dataKey: "time", tick: { fill: "#94a3b8", fontSize: 10 }, axisLine: false, tickLine: false }), /* @__PURE__ */ React.createElement(YAxis, { tick: { fill: "#94a3b8", fontSize: 10 }, axisLine: false, tickLine: false, domain: [0, 160] }), /* @__PURE__ */ React.createElement(
    Tooltip,
    {
      contentStyle: {
        background: "#ffffff",
        border: "none",
        borderRadius: "10px",
        fontSize: "12px",
        boxShadow: "0 2px 12px rgba(15,23,42,0.1)",
        color: "#334155"
      },
      formatter: (value) => [`${value ?? 0}%`, "고통 지수"]
    }
  ), /* @__PURE__ */ React.createElement(
    Area,
    {
      type: "monotone",
      dataKey: "index",
      stroke: "#64748b",
      strokeWidth: 1.5,
      fill: "url(#painGradient)",
      dot: (props) => {
        const { cx, cy, index } = props;
        const point = data[index];
        if (!cx || !cy || !point) return /* @__PURE__ */ React.createElement("g", null);
        const isActive = index === activeIndex;
        return /* @__PURE__ */ React.createElement(
          "circle",
          {
            key: index,
            cx,
            cy,
            r: isActive ? 5 : 3,
            fill: statusColor(point.status),
            stroke: isActive ? "#fff" : "none",
            strokeWidth: 2
          }
        );
      }
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "mt-1 flex justify-center gap-1" }, data.map((d) => /* @__PURE__ */ React.createElement(
    "span",
    {
      key: d.time,
      className: `h-2 w-2 rounded-sm ${CONGESTION_STYLES[d.status].dot}`,
      title: `${d.time}: ${d.index}%`
    }
  ))));
}
export {
  CongestionAreaChart
};
