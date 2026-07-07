import React from "react";
import { Bell, MapPin, Settings, Star, Train, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TimeBottomSheet, TimePickerButton } from "@/components/TimeBottomSheet";
import { useState } from "react";
function HomeScreen({ form, onFormChange, onSearch }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  return /* @__PURE__ */ React.createElement("div", { className: "animate-fade-in space-y-5 pb-24" }, /* @__PURE__ */ React.createElement("header", { className: "flex items-center justify-between px-1" }, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "icon", "aria-label": "설정" }, /* @__PURE__ */ React.createElement(Settings, { className: "h-5 w-5" })), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Train, { className: "h-5 w-5 text-slate-600" }), /* @__PURE__ */ React.createElement("h1", { className: "text-lg font-bold tracking-tight text-slate-800" }, "SUBWAY PREDICT")), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "icon", "aria-label": "프로필" }, /* @__PURE__ */ React.createElement(User, { className: "h-5 w-5" }))), /* @__PURE__ */ React.createElement(Card, { className: "bg-amber-50/60 shadow-[inset_0_1px_3px_rgba(245,158,11,0.06),0_2px_12px_rgba(245,158,11,0.08)]" }, /* @__PURE__ */ React.createElement(CardContent, { className: "p-4 pt-4" }, /* @__PURE__ */ React.createElement("div", { className: "mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800" }, /* @__PURE__ */ React.createElement(Bell, { className: "h-4 w-4" }), "오늘의 정체 예보"), /* @__PURE__ */ React.createElement("p", { className: "text-sm leading-relaxed text-slate-700" }, "🌧️ 18:00 퇴근길 비 예보 + 🎤 잠실 콘서트(2만명)"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 text-sm text-rose-700" }, "→ 2호선 사당-잠실 구간 18시~20시 혼잡도 ", /* @__PURE__ */ React.createElement("strong", null, "140%"), " 폭증 예상"))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("h2", { className: "mb-3 text-sm font-medium text-slate-600" }, "어디로 이동하시나요?"), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement(CardContent, { className: "space-y-3 p-4" }, /* @__PURE__ */ React.createElement("label", { className: "block" }, /* @__PURE__ */ React.createElement("span", { className: "mb-1.5 flex items-center gap-2 text-xs text-slate-500" }, /* @__PURE__ */ React.createElement(MapPin, { className: "h-3.5 w-3.5" }), " 출발"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: form.departure,
      onChange: (e) => onFormChange({ ...form, departure: e.target.value, departureStationId: null }),
      className: "w-full rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)] outline-none transition focus:bg-white focus:shadow-[inset_0_1px_3px_rgba(15,23,42,0.08),0_0_0_2px_rgba(148,163,184,0.25)]"
    }
  )), /* @__PURE__ */ React.createElement("label", { className: "block" }, /* @__PURE__ */ React.createElement("span", { className: "mb-1.5 flex items-center gap-2 text-xs text-slate-500" }, "도착"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: form.destination,
      onChange: (e) => onFormChange({ ...form, destination: e.target.value, destinationStationId: null }),
      className: "w-full rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)] outline-none transition focus:bg-white focus:shadow-[inset_0_1px_3px_rgba(15,23,42,0.08),0_0_0_2px_rgba(148,163,184,0.25)]"
    }
  )), /* @__PURE__ */ React.createElement(TimePickerButton, { value: form.targetTime, onClick: () => setSheetOpen(true) }), /* @__PURE__ */ React.createElement(Button, { size: "lg", className: "w-full", onClick: onSearch }, "경로 예측 검색")))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("h2", { className: "mb-3 flex items-center gap-2 text-sm font-medium text-slate-600" }, /* @__PURE__ */ React.createElement(Star, { className: "h-4 w-4 text-amber-500" }), " 자주 가는 쾌적 경로"), /* @__PURE__ */ React.createElement(
    Card,
    {
      className: "cursor-pointer transition-shadow hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.07)]",
      onClick: onSearch
    },
    /* @__PURE__ */ React.createElement(CardContent, { className: "p-4" }, /* @__PURE__ */ React.createElement("p", { className: "font-medium text-slate-800" }, "🏠 집 ➔ 🏢 회사 (2호선 오피스 라인)"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500" }, /* @__PURE__ */ React.createElement("span", null, "소요시간 32분"), /* @__PURE__ */ React.createElement("span", { className: "text-slate-300" }, "|"), /* @__PURE__ */ React.createElement("span", null, "현재: 🟢 여유"), /* @__PURE__ */ React.createElement(Badge, { variant: "warning", className: "text-[10px]" }, "30분 뒤 🟡 주의 예상")))
  )), /* @__PURE__ */ React.createElement(
    TimeBottomSheet,
    {
      open: sheetOpen,
      value: form.targetTime,
      onClose: () => setSheetOpen(false),
      onConfirm: (targetTime) => onFormChange({ ...form, targetTime })
    }
  ));
}
export {
  HomeScreen
};
