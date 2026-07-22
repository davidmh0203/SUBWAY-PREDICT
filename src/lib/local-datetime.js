/**
 * API로 보낼 "벽시계" 시각.
 * Date#toISOString()은 UTC(Z)라 KST 08:30 → 23:30으로 밀린다.
 * 여유로는 사용자가 고른 시·분을 그대로 보낸다 (타임존 접미사 없음).
 *
 * @param {Date} date
 * @returns {string} e.g. "2026-07-22T08:30:00"
 */
export function toLocalISOString(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError("toLocalISOString: invalid date");
  }
  const pad = (n) => String(n).padStart(2, "0");
  return [
    d.getFullYear(),
    "-",
    pad(d.getMonth() + 1),
    "-",
    pad(d.getDate()),
    "T",
    pad(d.getHours()),
    ":",
    pad(d.getMinutes()),
    ":",
    pad(d.getSeconds()),
  ].join("");
}
