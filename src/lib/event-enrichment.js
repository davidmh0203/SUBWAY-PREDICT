/**
 * 공휴일 day context에 따라 출퇴근 정체 예보 카드 문구를 보강합니다.
 * v1: category === "commute" 카드에만 공휴일 highlight 추가.
 */

function buildHolidayHighlight(holidayName) {
  const label = holidayName ? `${holidayName} ` : "";
  return `오늘은 ${label}공휴일이에요. 7~9시·18~20시 출퇴근 시간대 혼잡은 평소보다 낮을 수 있어요. 관광·나들이 구간은 따로 붐빌 수 있어요.`;
}

/**
 * @param {Array<Record<string, unknown>>} events
 * @param {{ isHoliday?: boolean, holidayName?: string | null } | null} dayContext
 */
export function enrichForecastEvents(events, dayContext) {
  if (!dayContext?.isHoliday) return events;

  return events.map((event) => {
    if (event.category !== "commute") return event;
    return {
      ...event,
      highlight: buildHolidayHighlight(dayContext.holidayName),
    };
  });
}
