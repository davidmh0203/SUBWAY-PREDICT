const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

const WEEKDAY_CONTEXT = {
  isHoliday: false,
  holidayName: null,
  commuteProfile: "weekday",
};

/**
 * @returns {Promise<{ date: string, isHoliday: boolean, holidayName: string | null, commuteProfile: string }>}
 */
export async function fetchTodayDayContext() {
  try {
    const response = await fetch(`${API_BASE}/calendar/today`);
    if (!response.ok) return { ...WEEKDAY_CONTEXT, date: new Date().toISOString().slice(0, 10) };
    return await response.json();
  } catch {
    return { ...WEEKDAY_CONTEXT, date: new Date().toISOString().slice(0, 10) };
  }
}

/**
 * @param {string} dateStr YYYY-MM-DD
 */
export async function fetchDayContext(dateStr) {
  try {
    const response = await fetch(`${API_BASE}/calendar/day?date=${encodeURIComponent(dateStr)}`);
    if (!response.ok) return { ...WEEKDAY_CONTEXT, date: dateStr };
    return await response.json();
  } catch {
    return { ...WEEKDAY_CONTEXT, date: dateStr };
  }
}
