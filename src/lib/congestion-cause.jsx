import {
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CloudRain,
  HelpCircle,
  Moon,
  PartyPopper,
  Sun,
  Sunrise,
} from "lucide-react";

/** 모델 cause 라벨 → 표시용 메타 */
const CAUSE_META = {
  강수: { icon: CloudRain, tone: "text-sky-700 bg-sky-50" },
  공휴일: { icon: Calendar, tone: "text-violet-700 bg-violet-50" },
  기타: { icon: HelpCircle, tone: "text-slate-600 bg-slate-100" },
  긴연휴: { icon: CalendarDays, tone: "text-violet-700 bg-violet-50" },
  아침피크: { icon: Sunrise, tone: "text-amber-700 bg-amber-50" },
  연휴다음날: { icon: CalendarClock, tone: "text-violet-700 bg-violet-50" },
  연휴전날: { icon: CalendarRange, tone: "text-violet-700 bg-violet-50" },
  저녁피크: { icon: Moon, tone: "text-indigo-700 bg-indigo-50" },
  주말: { icon: Sun, tone: "text-orange-700 bg-orange-50" },
  행사: { icon: PartyPopper, tone: "text-rose-700 bg-rose-50" },
};

/**
 * @param {string | null | undefined} cause
 * @returns {string | null}
 */
export function normalizeCause(cause) {
  if (!cause || cause === "분석불가" || cause === "-") return null;
  return String(cause).trim() || null;
}

/**
 * @param {string | null | undefined} cause
 */
export function getCauseMeta(cause) {
  const label = normalizeCause(cause);
  if (!label) return null;
  return CAUSE_META[label] ?? { icon: HelpCircle, tone: "text-slate-600 bg-slate-100" };
}

/**
 * 원인 칩 — CrowdBlock 옆·역명 옆에 쓰는 작은 배지
 */
export function CauseChip({ cause, size = "md", className = "" }) {
  const label = normalizeCause(cause);
  const meta = getCauseMeta(label);
  if (!label || !meta) return null;
  const Icon = meta.icon;
  const compact = size === "sm";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-0.5 rounded-md font-semibold ${meta.tone} ${
        compact ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
      } ${className}`}
      title={`예측 원인: ${label}`}
    >
      <Icon className={compact ? "h-2.5 w-2.5 shrink-0" : "h-3 w-3 shrink-0"} strokeWidth={2.25} />
      <span className="truncate">{label}</span>
    </span>
  );
}
