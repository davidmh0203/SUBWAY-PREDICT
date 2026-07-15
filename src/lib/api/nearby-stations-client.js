const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

/**
 * 카카오 로컬 기반 주변 지하철역
 * @param {{ lat: number, lng: number, radius?: number, limit?: number }} params
 */
export async function fetchNearbyStations({
  lat,
  lng,
  radius = 1500,
  limit = 4,
} = {}) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { source: null, stations: [] };
  }
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radius),
    limit: String(limit),
  });
  const res = await fetch(`${API_BASE}/stations/nearby?${params}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`stations/nearby ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  const data = await res.json();
  return {
    source: data.source ?? "kakao",
    stations: Array.isArray(data.stations) ? data.stations : [],
  };
}
