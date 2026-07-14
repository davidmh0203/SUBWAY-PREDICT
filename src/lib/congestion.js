const CROWD_COLORS = {
  RELAXED: "#3cb878",
  NORMAL: "#f5c542",
  BUSY: "#f59e3b",
  VERY_BUSY: "#e06060",
  EXTREME: "#8b1a1a",
};
const CROWD_LABELS = {
  RELAXED: "여유",
  NORMAL: "보통",
  BUSY: "혼잡",
  VERY_BUSY: "매우혼잡",
  EXTREME: "극혼잡",
};
/** 모델 CongestionPredictor CONGESTION_LEVELS와 동일 */
const CROWD_PERCENT_RANGES = {
  RELAXED: "<30%",
  NORMAL: "30–59%",
  BUSY: "60–79%",
  VERY_BUSY: "80–99%",
  EXTREME: "≥100%",
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
    line: "stroke-[#f59e3b] stroke-[5px] transition-all duration-500",
    station: "fill-[#f59e3b] r-[7px] transition-all duration-500",
    border: "border-[#f59e3b]",
    bg: "bg-amber-50 text-amber-800",
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-[#f59e3b]",
    label: "혼잡",
    emoji: "",
    width: "border-l-[3px]",
    crowd: "BUSY"
  },
  DANGER: {
    line: "stroke-[#e06060] stroke-[7px] transition-all duration-500",
    station: "fill-[#e06060] r-[8px] transition-all duration-500",
    border: "border-[#e06060]",
    bg: "bg-rose-50 text-rose-800",
    badge: "bg-rose-50 text-rose-700",
    dot: "bg-[#e06060]",
    label: "매우혼잡",
    emoji: "",
    width: "border-l-[4px]",
    crowd: "VERY_BUSY"
  }
};

const API_LEVEL_TO_CROWD = {
  여유: "RELAXED",
  보통: "NORMAL",
  혼잡: "BUSY",
  매우혼잡: "VERY_BUSY",
  극혼잡: "EXTREME",
  // 구버전 호환
  주의: "BUSY",
};

function rateToCrowdLevel(rate) {
  const pct = Number(rate) || 0;
  if (pct >= 100) return "EXTREME";
  if (pct >= 80) return "VERY_BUSY";
  if (pct >= 60) return "BUSY";
  if (pct >= 30) return "NORMAL";
  return "RELAXED";
}

function crowdLevelFromApiLevel(level) {
  return API_LEVEL_TO_CROWD[level] ?? rateToCrowdLevel(0);
}

function crowdLevelToStatus(level) {
  if (level === "RELAXED" || level === "NORMAL") return "SMOOTH";
  if (level === "BUSY") return "WARNING";
  return "DANGER";
}

function getStatusFromRate(rate) {
  return crowdLevelToStatus(rateToCrowdLevel(rate));
}

function getStatusFromApiLevel(level) {
  return crowdLevelToStatus(crowdLevelFromApiLevel(level));
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
  API_LEVEL_TO_CROWD,
  CONGESTION_STYLES,
  CROWD_COLORS,
  CROWD_LABELS,
  CROWD_PERCENT_RANGES,
  addMinutes,
  crowdLevelFromApiLevel,
  crowdLevelToStatus,
  formatDateLabel,
  formatDepartureLabel,
  formatTime,
  getStatusFromApiLevel,
  getStatusFromRate,
  minutesToTime,
  rateToCrowdLevel,
  timeToMinutes
};
