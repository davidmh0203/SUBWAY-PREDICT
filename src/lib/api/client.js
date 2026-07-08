import { adaptApiRouteResponse } from "@/lib/api/route-adapter";

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
      departure_time: departureTime.toISOString(),
    }),
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
  return adaptApiRouteResponse(data, departureTime);
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
