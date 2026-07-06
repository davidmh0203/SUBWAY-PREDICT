import type { CongestionStatus, CrowdLevel } from "./types";

export const CROWD_COLORS: Record<CrowdLevel, string> = {
  RELAXED: "#3cb878",
  NORMAL: "#5b9bd5",
  BUSY: "#8b6cc1",
  VERY_BUSY: "#e06090",
};

export const CROWD_LABELS: Record<CrowdLevel, string> = {
  RELAXED: "여유",
  NORMAL: "보통",
  BUSY: "혼잡",
  VERY_BUSY: "매우혼잡",
};

export const CONGESTION_STYLES = {
  SMOOTH: {
    line: "stroke-[#3cb878] stroke-[4px] transition-all duration-500",
    station: "fill-[#3cb878] r-[6px] transition-all duration-500",
    border: "border-[#3cb878]",
    bg: "bg-emerald-50 text-emerald-800",
    badge: "bg-emerald-50 text-emerald-700",
    dot: "bg-[#3cb878]",
    label: "여유",
    emoji: "",
    width: "border-l-2",
    crowd: "RELAXED" as CrowdLevel,
  },
  WARNING: {
    line: "stroke-[#8b6cc1] stroke-[5px] transition-all duration-500",
    station: "fill-[#8b6cc1] r-[7px] transition-all duration-500",
    border: "border-[#8b6cc1]",
    bg: "bg-violet-50 text-violet-800",
    badge: "bg-violet-50 text-violet-700",
    dot: "bg-[#8b6cc1]",
    label: "혼잡",
    emoji: "",
    width: "border-l-[3px]",
    crowd: "BUSY" as CrowdLevel,
  },
  DANGER: {
    line: "stroke-[#e06090] stroke-[7px] transition-all duration-500",
    station: "fill-[#e06090] r-[8px] transition-all duration-500",
    border: "border-[#e06090]",
    bg: "bg-rose-50 text-rose-800",
    badge: "bg-rose-50 text-rose-700",
    dot: "bg-[#e06090]",
    label: "매우혼잡",
    emoji: "",
    width: "border-l-[4px]",
    crowd: "VERY_BUSY" as CrowdLevel,
  },
} as const;

export function rateToCrowdLevel(rate: number): CrowdLevel {
  if (rate <= 55) return "RELAXED";
  if (rate <= 85) return "NORMAL";
  if (rate <= 115) return "BUSY";
  return "VERY_BUSY";
}

export function crowdLevelToStatus(level: CrowdLevel): CongestionStatus {
  if (level === "RELAXED") return "SMOOTH";
  if (level === "NORMAL" || level === "BUSY") return "WARNING";
  return "DANGER";
}

export function getStatusFromRate(rate: number): CongestionStatus {
  return crowdLevelToStatus(rateToCrowdLevel(rate));
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDateLabel(date: Date): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  const prefix = isToday ? "오늘" : `${date.getMonth() + 1}/${date.getDate()}`;
  return `${prefix}(${days[date.getDay()]}) ${formatTime(date)}`;
}

export function formatDepartureLabel(date: Date): string {
  return `${date.getHours()}시 ${String(date.getMinutes()).padStart(2, "0")}분 출발`;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
