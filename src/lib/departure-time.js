/**
 * 출발 시각 라벨·슬라이더·막차 이후 첫차 폴백.
 *
 * 출퇴근 윈도우 (평일·주말 공통, MVP):
 * - 출근: 07:00–09:00 (포함)
 * - 퇴근: 17:30–20:00 (포함)
 *
 * 운행 공백(막차 후~첫차 전): 00:00–04:59 → 당일 05:30 첫차 기준으로 검색
 */

export const COMMUTE = {
  morningStartMin: 7 * 60,
  morningEndMin: 9 * 60,
  eveningStartMin: 17 * 60 + 30,
  eveningEndMin: 20 * 60,
};

/** 첫차 기본 시각 (수도권 대략값) */
export const FIRST_TRAIN = { hour: 5, minute: 30 };

/** 이 시각 미만은 심야·운행 종료 구간으로 본다 */
export const SERVICE_GAP_END_MIN = 5 * 60; // 05:00

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * @param {Date} date
 * @returns {"morning"|"evening"|null}
 */
export function getCommutePeriod(date) {
  const m = minutesOfDay(date);
  if (m >= COMMUTE.morningStartMin && m <= COMMUTE.morningEndMin) return "morning";
  if (m >= COMMUTE.eveningStartMin && m <= COMMUTE.eveningEndMin) return "evening";
  return null;
}

/**
 * @param {Date} date
 * @returns {string|null} 예: "출근 시간" | "퇴근 시간"
 */
export function getCommuteLabel(date) {
  const period = getCommutePeriod(date);
  if (period === "morning") return "출근 시간";
  if (period === "evening") return "퇴근 시간";
  return null;
}

/**
 * @param {Date} date
 * @returns {boolean} 막차 이후 ~ 첫차 직전 (운영 공백)
 */
export function isAfterLastBeforeFirst(date) {
  return minutesOfDay(date) < SERVICE_GAP_END_MIN;
}

/**
 * @param {Date} requested
 * @returns {{
 *   requested: Date,
 *   effective: Date,
 *   mode: "normal"|"first-train",
 *   commuteLabel: string|null,
 *   scheduleLabel: string|null,
 * }}
 */
export function resolveEffectiveDeparture(requested) {
  const req = new Date(requested);
  const commuteLabel = getCommuteLabel(req);

  if (isAfterLastBeforeFirst(req)) {
    const effective = new Date(req);
    effective.setHours(FIRST_TRAIN.hour, FIRST_TRAIN.minute, 0, 0);
    return {
      requested: req,
      effective,
      mode: "first-train",
      commuteLabel: null,
      scheduleLabel: "첫차",
    };
  }

  return {
    requested: req,
    effective: req,
    mode: "normal",
    commuteLabel,
    scheduleLabel: null,
  };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * 중심 시각 기준 ±(count-1)/2 스텝의 HH:mm 마크 배열.
 * @param {Date} center
 * @param {{ stepMin?: number, count?: number }} [opts]
 * @returns {string[]}
 */
export function buildSliderMarksAround(center, opts = {}) {
  const stepMin = opts.stepMin ?? 30;
  const count = opts.count ?? 5;
  const half = Math.floor(count / 2);
  const base = new Date(center);
  const centerMin = minutesOfDay(base);
  // 가장 가까운 step에 스냅
  const snapped = Math.round(centerMin / stepMin) * stepMin;

  const marks = [];
  for (let i = -half; i <= half; i += 1) {
    let total = snapped + i * stepMin;
    // 음수/24h+ 도 표시를 위해 날짜와 무관하게 mod 24h
    total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    marks.push(`${pad2(h)}:${pad2(m)}`);
  }
  return marks;
}

/**
 * @param {string[]} marks
 * @param {number} index
 * @param {Date} baseDate
 */
export function sliderIndexToDateWithMarks(marks, index, baseDate) {
  const time = marks[index] ?? marks[Math.floor(marks.length / 2)] ?? "12:00";
  const [h, m] = time.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  // 심야 마크가 전날로 넘어가는 경우 (예: 23:30 after 00:30 center) —
  // 당일 기준 시각만 쓴다 (베이스 날짜 유지)
  return d;
}

/**
 * @param {string[]} marks
 * @param {Date} date
 */
export function dateToSliderIndexWithMarks(marks, date) {
  const minutes = minutesOfDay(date);
  let best = Math.floor(marks.length / 2);
  let bestDiff = Infinity;
  marks.forEach((t, i) => {
    const [h, m] = t.split(":").map(Number);
    const diff = Math.abs(h * 60 + m - minutes);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  return best;
}
