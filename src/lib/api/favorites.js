import { authHeaders, clearToken } from "@/lib/api/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function parseErrorDetail(res) {
  try {
    const body = await res.json();
    return body?.detail;
  } catch {
    return null;
  }
}

async function handleAuthedResponse(res) {
  if (res.status === 401) {
    clearToken();
  }
  if (!res.ok) {
    throw new Error((await parseErrorDetail(res)) ?? `favorites ${res.status}`);
  }
  return res;
}

/**
 * @returns {Promise<Array<{ id: number, start_name: string, end_name: string, route_key: string, route_label: string, departure_time: string, created_at: string }>>}
 */
export async function listFavorites() {
  const res = await fetch(`${API_BASE}/favorites`, {
    headers: { ...authHeaders() },
  });
  await handleAuthedResponse(res);
  const data = await res.json();
  return data.favorites ?? [];
}

/**
 * @param {{ startName: string, endName: string, routeKey: string, routeLabel: string, departureTime: string }} params departureTime는 "HH:MM"
 */
export async function addFavorite({ startName, endName, routeKey, routeLabel, departureTime }) {
  const res = await fetch(`${API_BASE}/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      start_name: startName,
      end_name: endName,
      route_key: routeKey,
      route_label: routeLabel,
      departure_time: departureTime,
    }),
  });
  await handleAuthedResponse(res);
  return res.json();
}

/**
 * @param {number} id
 */
export async function removeFavorite(id) {
  const res = await fetch(`${API_BASE}/favorites/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  await handleAuthedResponse(res);
}
