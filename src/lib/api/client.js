import { adaptApiRouteResponse } from "@/lib/api/route-adapter";
import { applyCongestionMapToRoutes, collectStationNamesFromRoutes } from "@/lib/api/apply-congestion";
import { buildLocalGraphRoutes } from "@/lib/mock-data";
import { rateToCrowdLevel } from "@/lib/congestion";
import { toLocalISOString } from "@/lib/local-datetime";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

function parseErrorDetail(text) {
  if (!text) return "";
  try {
    const j = JSON.parse(text);
    if (typeof j?.detail === "string") return j.detail;
    if (Array.isArray(j?.detail)) {
      return j.detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
    }
  } catch {
    /* plain text */
  }
  return text;
}

function isUnsupportedLineError(status, detail) {
  if (status === 422) return true;
  return /1\s*~\s*8호선|unsupported_lines|신분당|미지원/i.test(detail || "");
}

/** Free Render 콜드스타트 완화 — predict 직전 health로 깨우기 */
async function wakeApiIfNeeded() {
  try {
    await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    /* predict 쪽에서 최종 오류 처리 */
  }
}

/**
 * ODsay가 9호선·신분당만 줄 때 로컬 1~8 노선도 그래프로 대체.
 * 가짜 출발·도착만 있는 mock 경로는 쓰지 않음.
 */
async function fetchLocalGraphRoutes(start, end, departureTime) {
  const routes = buildLocalGraphRoutes(departureTime, start, end);
  if (!routes.length) return [];

  try {
    const names = collectStationNamesFromRoutes(routes);
    if (names.length) {
      const batch = await fetchBatchCongestion(names, departureTime);
      return applyCongestionMapToRoutes(routes, batch.byName ?? {});
    }
  } catch {
    /* 혼잡 배치 실패해도 경로 자체는 반환 */
  }
  return routes;
}

/**
 * @param {{ start: string, end: string, departureTime: Date }} params
 */
export async function predictRoute({ start, end, departureTime }) {
  await wakeApiIfNeeded();

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
    const raw = await res.text().catch(() => "");
    const detail = parseErrorDetail(raw);
    const err = new Error(
      `predict/route ${res.status}${detail ? `: ${detail}` : ""}`,
    );
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  return res.json();
}

/**
 * @param {string} start
 * @param {string} end
 * @param {Date} departureTime
 */
export async function fetchRoutesFromApi(start, end, departureTime) {
  try {
    const data = await predictRoute({ start, end, departureTime });
    // 운영 빌드에서 백엔드가 mock 경로(출발·도착만 등)를 주면 카드로 쓰지 않음
    if (import.meta.env.PROD && data?.source === "mock") {
      throw new Error(
        "경로 탐색(ODsay)에 실패해 실제 경로를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
    return adaptApiRouteResponse(data, departureTime);
  } catch (err) {
    const status = err?.status;
    const detail = err?.detail || (err instanceof Error ? err.message : String(err));
    if (isUnsupportedLineError(status, detail)) {
      const local = await fetchLocalGraphRoutes(start, end, departureTime);
      if (local.length) return local;
      throw new Error(
        "1~8호선만으로 이동 가능한 경로가 없습니다. (9호선·신분당선 구간은 아직 지원하지 않아요)",
      );
    }
    throw err;
  }
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
  /** @type {Record<string, { rate: number, level: string, cause?: string | null, source?: string }>} */
  const byName = {};
  for (const s of data.stations ?? []) {
    byName[s.name] = {
      rate: s.station_congestion,
      level: s.level,
      cause: s.cause ?? null,
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
