import React from "react";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CarCongestionHeatmap } from "@/components/CarCongestionHeatmap";
import { RouteSchematic } from "@/components/RouteSchematic";
import { getCarCongestionRows } from "@/lib/crowd-data";
function RouteDetailScreen({ route, departureTime, onBack }) {
  const timeOffset = departureTime.getHours() * 60 + departureTime.getMinutes() - (18 * 60 + 30);
  const carRows = useMemo(() => getCarCongestionRows(timeOffset), [timeOffset]);
  const dangerStation = route.stationPredictions.find(
    (p) => p.trigger === "KOPIS_EVENT" || p.congestionRate >= 120
  );
  return /* @__PURE__ */ React.createElement("div", { className: "animate-fade-in space-y-5 pb-24" }, /* @__PURE__ */ React.createElement("header", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "icon", onClick: onBack }, /* @__PURE__ */ React.createElement(ArrowLeft, { className: "h-5 w-5" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", { className: "font-semibold text-slate-800" }, "경로 상세"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500" }, route.stations.join(" → ")))), route.segments && route.segments.length > 0 && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement(CardContent, { className: "p-4 pt-5" }, /* @__PURE__ */ React.createElement("p", { className: "mb-4 text-xs font-semibold text-slate-500" }, "경로 다이어그램"), /* @__PURE__ */ React.createElement(RouteSchematic, { segments: route.segments }))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement(CardContent, { className: "p-4 pt-5" }, /* @__PURE__ */ React.createElement(CarCongestionHeatmap, { rows: carRows, departureTime }))), dangerStation && /* @__PURE__ */ React.createElement(Card, { className: "bg-slate-50 shadow-[inset_0_1px_3px_rgba(15,23,42,0.04)]" }, /* @__PURE__ */ React.createElement(CardContent, { className: "p-4" }, /* @__PURE__ */ React.createElement("p", { className: "mb-1 text-xs font-medium text-slate-500" }, "대안 안내"), /* @__PURE__ */ React.createElement("p", { className: "text-sm leading-relaxed text-slate-700" }, dangerStation.stationName, "역에서 하차 후 4분 뒤 다음 열차를 이용하면 혼잡도가 ", /* @__PURE__ */ React.createElement("strong", { className: "text-emerald-700" }, "약 40% 감소"), "합니다."))));
}
export {
  RouteDetailScreen
};
