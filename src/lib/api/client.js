import { adaptApiRouteResponse } from "@/lib/api/route-adapter";
import { rateToCrowdLevel } from "@/lib/congestion";
import { toLocalISOString } from "@/lib/local-datetime";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

/**
 * @param {{ start: string, end: string, departureTime: Date }} params
 */
export async function predictRoute({ start, end, departureTime }) {
  const res = await fetch(`${API_BASE}/predict/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start,
      end,
      departure_time: toLocalISOString(departureTime),
    }),
    // Free Render 콜드스타트·모델 로딩 여유
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`predict/route ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  return res.json();
}

/**
 * @param {string} start
 * @param {string} end
 * @param {Date} departureTime
 */
export async function fetchRoutesFromApi(start, end, departureTime) {
  const data = await predictRoute({ start, end, departureTime });
  // 운영 빌드에서 백엔드가 mock 경로(출발·도착만 등)를 주면 카드로 쓰지 않음
  if (import.meta.env.PROD && data?.source === "mock") {
    throw new Error(
      "경로 탐색(ODsay)에 실패해 실제 경로를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  return adaptApiRouteResponse(data, departureTime);
}

/**
 * 출발역 시간대별 혼잡 (ODsay 없음, 모델만)
 * @param {string} stationName
 * @param {Date} day
 */
export async function fetchHourlyCongestion(stationName, day) {
  const date = [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-");
  const params = new URLSearchParams({
    name: stationName.replace(/역.*$/, "").trim(),
    date,
  });
  const res = await fetch(`${API_BASE}/congestion/hourly?${params}`);
  if (!res.ok) {
    throw new Error(`congestion/hourly ${res.status}`);
  }
  const data = await res.json();
  return {
    source: data.source,
    points: (data.points ?? []).map((p) => ({
      hour: p.hour,
      rate: p.rate,
      level: rateToCrowdLevel(p.rate),
      apiLevel: p.level,
      source: p.source,
    })),
  };
}


/**
 * 여러 역 혼잡도 일괄 (ODsay 없음, 슬라이더용)
 * @param {string[]} names
 * @param {Date} departureTime
 */
export async function fetchBatchCongestion(names, departureTime) {
  const res = await fetch(`${API_BASE}/congestion/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      names,
      departure_time: toLocalISOString(departureTime),
    }),
  });
  if (!res.ok) {
    throw new Error(`congestion/batch ${res.status}`);
  }
  const data = await res.json();
  /** @type {Record<string, { rate: number, level: string, source?: string }>} */
  const byName = {};
  for (const s of data.stations ?? []) {
    byName[s.name] = {
      rate: s.station_congestion,
      level: s.level,
      source: s.source,
    };
  }
  return { source: data.source, byName };
}

/**
 * @returns {Promise<boolean>}
 */
export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
