import { authHeaders, clearToken, isUsingSupabaseAuth } from "@/lib/api/auth";
import {
  addFavoriteSupabase,
  listFavoritesSupabase,
  removeFavoriteSupabase,
} from "@/lib/api/favorites-supabase";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function parseErrorDetail(res) {
  try {
    const body = await res.json();
    return body?.detail;
  } catch {
    return null;
  }
}

async function listFavoritesApi() {
  const res = await fetch(`${API_BASE}/favorites`, {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) {
    clearToken();
    throw new Error("인증이 만료되었습니다");
  }
  if (!res.ok) {
    throw new Error((await parseErrorDetail(res)) ?? `favorites ${res.status}`);
  }
  const data = await res.json();
  return data.favorites ?? [];
}

async function addFavoriteApi(body) {
  const res = await fetch(`${API_BASE}/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error((await parseErrorDetail(res)) ?? `favorites ${res.status}`);
  }
  return res.json();
}

async function removeFavoriteApi(id) {
  const res = await fetch(`${API_BASE}/favorites/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    throw new Error((await parseErrorDetail(res)) ?? `favorites ${res.status}`);
  }
}

export async function listFavorites() {
  if (isUsingSupabaseAuth()) return listFavoritesSupabase();
  return listFavoritesApi();
}

export async function addFavorite({
  startName,
  endName,
  routeKey,
  routeLabel,
  departureTime,
}) {
  if (isUsingSupabaseAuth()) {
    return addFavoriteSupabase({
      startName,
      endName,
      routeKey,
      routeLabel,
      departureTime,
    });
  }
  return addFavoriteApi({
    start_name: startName,
    end_name: endName,
    route_key: routeKey,
    route_label: routeLabel,
    departure_time: departureTime,
  });
}

export async function removeFavorite(id) {
  if (isUsingSupabaseAuth()) return removeFavoriteSupabase(id);
  return removeFavoriteApi(id);
}
