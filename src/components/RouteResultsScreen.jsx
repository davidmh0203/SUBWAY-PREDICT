import React from "react";
import { ArrowLeft, Clock, Coins, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { HourlyCongestionChart } from "@/components/HourlyCongestionChart";
import { CROWD_LABELS, rateToCrowdLevel } from "@/lib/congestion";
import { getHourlyCongestionData } from "@/lib/crowd-data";
import {
  SLIDER_MARKS,
  buildRoutes,
  dateToSliderIndex,
  sliderIndexToDate
} from "@/lib/mock-data";
function RouteResultsScreen({
  form,
  onBack,
  onSelectRoute,
  onTimeChange
}) {
  const [sliderIndex, setSliderIndex] = useState(() => dateToSliderIndex(form.targetTime));
  const [debouncedTime, setDebouncedTime] = useState(form.targetTime);
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState("강남 방면");
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const next = sliderIndexToDate(sliderIndex, form.targetTime);
      setDebouncedTime(next);
      onTimeChange(next);
      setLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [sliderIndex, form.targetTime, onTimeChange]);
  const routes = useMemo(
    () => buildRoutes(debouncedTime, form.departure.replace(/역.*$/, ""), form.destination.replace(/역.*$/, "")),
    [debouncedTime, form.departure, form.destination]
  );
  const activeHour = debouncedTime.getHours();
  const hourlyData = useMemo(() => getHourlyCongestionData(activeHour), [activeHour]);
  return /* @__PURE__ */ React.createElement("div", { className: "animate-fade-in space-y-5 pb-24" }, /* @__PURE__ */ React.createElement("header", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "icon", onClick: onBack }, /* @__PURE__ */ React.createElement(ArrowLeft, { className: "h-5 w-5" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500" }, "경로 검색 결과"), /* @__PURE__ */ React.createElement("h1", { className: "font-semibold text-slate-800" }, form.departure, " → ", form.destination))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement(CardContent, { className: "space-y-4 p-4 pt-5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500" }, "출발 시각을 조절하면 아래 차트가 갱신됩니다"), loading && /* @__PURE__ */ React.createElement(RefreshCw, { className: "h-4 w-4 animate-spin text-slate-400" })), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between px-1 text-xs text-slate-400 tabular-nums" }, SLIDER_MARKS.map((t, i) => /* @__PURE__ */ React.createElement("span", { key: t, className: i === sliderIndex ? "font-bold text-slate-800" : "" }, t))), /* @__PURE__ */ React.createElement(
    Slider,
    {
      min: 0,
      max: SLIDER_MARKS.length - 1,
      step: 1,
      value: [sliderIndex],
      onValueChange: ([v]) => setSliderIndex(v)
    }
  ), /* @__PURE__ */ React.createElement(
    HourlyCongestionChart,
    {
      data: hourlyData,
      activeHour,
      stationName: "사당",
      lineName: "2호선",
      direction,
      onDirectionSwap: () => setDirection((d) => d === "강남 방면" ? "신도림 방면" : "강남 방면")
    }
  ))), /* @__PURE__ */ React.createElement("section", { className: "space-y-3" }, /* @__PURE__ */ React.createElement("h2", { className: "text-sm font-semibold text-slate-600" }, "추천 경로"), routes.map((route, idx) => {
    const crowdLevel = rateToCrowdLevel(route.maxCongestion);
    return /* @__PURE__ */ React.createElement(
      Card,
      {
        key: route.id,
        className: `cursor-pointer transition-shadow duration-300 hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.07)] ${route.recommended ? "shadow-[0_2px_8px_rgba(15,23,42,0.08)]" : ""}`,
        onClick: () => onSelectRoute(route)
      },
      /* @__PURE__ */ React.createElement(CardContent, { className: "p-4" }, /* @__PURE__ */ React.createElement("div", { className: "mb-2 flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "font-semibold text-slate-800" }, idx === 0 ? "최단 시간" : "쾌적 우선"), /* @__PURE__ */ React.createElement(Badge, { variant: "primary" }, route.badge), route.recommended && /* @__PURE__ */ React.createElement(Badge, { variant: "smooth", className: "ml-auto" }, "추천")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-3 text-sm text-slate-600" }, /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Clock, { className: "h-3.5 w-3.5" }), route.totalTime, "분", idx === 1 && /* @__PURE__ */ React.createElement("span", { className: "text-slate-400" }, "(+7분)")), /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Coins, { className: "h-3.5 w-3.5" }), route.payment.toLocaleString(), "원"), /* @__PURE__ */ React.createElement("span", null, route.lineName, " · 환승 ", route.transfers, "회")), /* @__PURE__ */ React.createElement("p", { className: "mt-2 text-sm text-slate-500" }, "혼잡도 ", /* @__PURE__ */ React.createElement("strong", { className: "text-slate-700" }, CROWD_LABELS[crowdLevel]), " ", "(최대 ", route.maxCongestion, "%)"))
    );
  })));
}
export {
  RouteResultsScreen
};
