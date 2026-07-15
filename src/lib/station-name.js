/**
 * 역명 표시·정규화.
 * ODsay/레지스트리는 "서울역"처럼 이미 "역"이 붙은 이름이 섞여
 * UI에서 무조건 `…역`을 붙이면 "서울역역"이 된다.
 */

/** 끝의 "역" 접미사 제거 (없으면 그대로) */
export function stripStationSuffix(name) {
  return String(name ?? "")
    .trim()
    .replace(/역$/u, "");
}

/**
 * 화면에 쓸 역명 — 항상 `○○역` 한 번만.
 * @param {string} name
 * @param {{ suffix?: boolean }} [opts] suffix false면 접미사 없이 본체만
 */
export function formatStationLabel(name, opts = {}) {
  const { suffix = true } = opts;
  const base = stripStationSuffix(name);
  if (!base) return "";
  return suffix ? `${base}역` : base;
}
