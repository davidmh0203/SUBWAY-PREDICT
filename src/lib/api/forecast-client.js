const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

/**
 * @param {{
 *   lat?: number|null,
 *   lng?: number|null,
 *   stations?: string[],
 *   at?: Date|null,
 * }} opts
 * @returns {Promise<{ cards: Array<Record<string, unknown>>, date?: string, sources?: Record<string, unknown> } | null>}
 */
export async function fetchForecastCards({ lat, lng, stations, at } = {}) {
  const params = new URLSearchParams();
  if (lat != null && Number.isFinite(lat)) params.set("lat", String(lat));
  if (lng != null && Number.isFinite(lng)) params.set("lng", String(lng));
  if (stations?.length) params.set("stations", stations.join(","));
  if (at instanceof Date && !Number.isNaN(at.getTime())) {
    params.set("at", at.toISOString());
  }

  const qs = params.toString();
  try {
    const response = await fetch(
      `${API_BASE}/forecast/cards${qs ? `?${qs}` : ""}`,
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
