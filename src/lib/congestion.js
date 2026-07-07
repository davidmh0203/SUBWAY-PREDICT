const CROWD_COLORS = {
  RELAXED: "#3cb878",
  NORMAL: "#5b9bd5",
  BUSY: "#8b6cc1",
  VERY_BUSY: "#e06090"
};
const CROWD_LABELS = {
  RELAXED: "여유",
  NORMAL: "보통",
  BUSY: "혼잡",
  VERY_BUSY: "매우혼잡"
};
const CONGESTION_STYLES = {
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
    crowd: "RELAXED"
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
    crowd: "BUSY"
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
    crowd: "VERY_BUSY"
  }
};
function rateToCrowdLevel(rate) {
  if (rate <= 55) return "RELAXED";
  if (rate <= 85) return "NORMAL";
  if (rate <= 115) return "BUSY";
  return "VERY_BUSY";
}
function crowdLevelToStatus(level) {
  if (level === "RELAXED") return "SMOOTH";
  if (level === "NORMAL" || level === "BUSY") return "WARNING";
  return "DANGER";
}
function getStatusFromRate(rate) {
  return crowdLevelToStatus(rateToCrowdLevel(rate));
}
function formatTime(date) {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}
function formatDateLabel(date) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const today = /* @__PURE__ */ new Date();
  const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  const prefix = isToday ? "오늘" : `${date.getMonth() + 1}/${date.getDate()}`;
  return `${prefix}(${days[date.getDay()]}) ${formatTime(date)}`;
}
function formatDepartureLabel(date) {
  return `${date.getHours()}시 ${String(date.getMinutes()).padStart(2, "0")}분 출발`;
}
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 6e4);
}
function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(total) {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export {
  CONGESTION_STYLES,
  CROWD_COLORS,
  CROWD_LABELS,
  addMinutes,
  crowdLevelToStatus,
  formatDateLabel,
  formatDepartureLabel,
  formatTime,
  getStatusFromRate,
  minutesToTime,
  rateToCrowdLevel,
  timeToMinutes
};
