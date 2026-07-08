import { normalizeStationSearchQuery } from "@/lib/odsay-station.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

/** 백엔드 ODsay 프록시 상태 */
export async function getOdsayStatus() {
  const res = await fetch(`${API_BASE}/odsay/status`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

/**
 * 역 검색 — ODsay 직연결 대신 백엔드 /odsay/search-station 경유
 */
export async function searchOdsayStation(rawQuery, options = {}) {
  const {
    cid = undefined,
    displayCnt = 20,
    normalize = true,
  } = options;

  const stationName = normalize
    ? normalizeStationSearchQuery(rawQuery)
    : rawQuery.trim();

  if (stationName.length < 2) {
    throw new Error("역 이름은 2자 이상이어야 합니다. (「역」만 입력하면 검색되지 않습니다)");
  }

  const params = new URLSearchParams({ query: rawQuery, displayCnt: String(displayCnt) });
  if (cid != null) params.set("cid", String(cid));
  if (!normalize) params.set("normalize", "false");

  const res = await fetch(`${API_BASE}/odsay/search-station?${params}`);
  const data = await res.json();

  if (!res.ok) {
    const message = data?.detail ?? `ODsay 프록시 오류 (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  if (data.error) {
    const message = Array.isArray(data.error)
      ? data.error.map((e) => e.message).join(", ")
      : String(data.error);
    throw new Error(message);
  }

  return {
    status: res.status,
    data,
    query: {
      input: rawQuery,
      apiStationName: stationName,
      stripped역: normalize && rawQuery.trim() !== stationName,
      normalized: normalize,
    },
  };
}
