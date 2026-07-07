import React from "react";
import { useEffect, useState } from "react";
import { Calendar, ChevronDown, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateLabel } from "@/lib/congestion";
function TimeBottomSheet({ open, value, onClose, onConfirm }) {
  const [draft, setDraft] = useState(new Date(value));
  useEffect(() => {
    if (open) setDraft(new Date(value));
  }, [open, value]);
  if (!open) return null;
  const adjust = (field, delta) => {
    setDraft((prev) => {
      const next = new Date(prev);
      if (field === "month") next.setMonth(next.getMonth() + delta);
      if (field === "day") next.setDate(next.getDate() + delta);
      if (field === "hour") next.setHours(next.getHours() + delta);
      if (field === "minute") next.setMinutes(next.getMinutes() + delta * 5);
      return next;
    });
  };
  const Row = ({
    label,
    display,
    onMinus,
    onPlus
  }) => /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)]" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm text-slate-500" }, label), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onMinus, className: "rounded-lg p-2 text-slate-500 hover:bg-slate-200/60" }, /* @__PURE__ */ React.createElement(Minus, { className: "h-4 w-4" })), /* @__PURE__ */ React.createElement("span", { className: "min-w-[4.5rem] text-center font-semibold tabular-nums text-slate-800" }, display), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onPlus, className: "rounded-lg p-2 text-slate-500 hover:bg-slate-200/60" }, /* @__PURE__ */ React.createElement(Plus, { className: "h-4 w-4" }))));
  return /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-end justify-center" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "absolute inset-0 bg-black/20 animate-fade-in",
      onClick: onClose,
      "aria-label": "닫기"
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "relative z-10 w-full max-w-lg rounded-t-2xl bg-white p-6 pb-8 animate-slide-up shadow-[0_-4px_32px_rgba(15,23,42,0.12)]" }, /* @__PURE__ */ React.createElement("div", { className: "mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" }), /* @__PURE__ */ React.createElement("div", { className: "mb-6 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Calendar, { className: "h-5 w-5 text-slate-600" }), /* @__PURE__ */ React.createElement("h3", { className: "text-lg font-semibold text-slate-800" }, "출발 시간 설정")), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React.createElement(
    Row,
    {
      label: "월",
      display: `${draft.getMonth() + 1}월`,
      onMinus: () => adjust("month", -1),
      onPlus: () => adjust("month", 1)
    }
  ), /* @__PURE__ */ React.createElement(
    Row,
    {
      label: "일",
      display: `${draft.getDate()}일`,
      onMinus: () => adjust("day", -1),
      onPlus: () => adjust("day", 1)
    }
  ), /* @__PURE__ */ React.createElement(
    Row,
    {
      label: "시",
      display: `${String(draft.getHours()).padStart(2, "0")}시`,
      onMinus: () => adjust("hour", -1),
      onPlus: () => adjust("hour", 1)
    }
  ), /* @__PURE__ */ React.createElement(
    Row,
    {
      label: "분",
      display: `${String(draft.getMinutes()).padStart(2, "0")}분`,
      onMinus: () => adjust("minute", -1),
      onPlus: () => adjust("minute", 1)
    }
  )), /* @__PURE__ */ React.createElement("p", { className: "mt-4 text-center text-sm text-slate-500" }, formatDateLabel(draft), " (퇴근 시간)"), /* @__PURE__ */ React.createElement("div", { className: "mt-6 flex gap-3" }, /* @__PURE__ */ React.createElement(Button, { variant: "secondary", className: "flex-1", onClick: onClose }, "취소"), /* @__PURE__ */ React.createElement(Button, { className: "flex-1", onClick: () => {
    onConfirm(draft);
    onClose();
  } }, "적용"))));
}
function TimePickerButton({ value, onClick, className }) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick,
      className: cn(
        "flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-left shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)] transition hover:bg-slate-100/80",
        className
      )
    },
    /* @__PURE__ */ React.createElement("span", { className: "text-sm text-slate-500" }, "출발 시간"),
    /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-2 font-medium text-slate-800" }, formatDateLabel(value), /* @__PURE__ */ React.createElement(ChevronDown, { className: "h-4 w-4 text-slate-400" }))
  );
}
export {
  TimeBottomSheet,
  TimePickerButton
};
