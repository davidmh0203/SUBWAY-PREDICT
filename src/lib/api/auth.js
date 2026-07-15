const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const TOKEN_KEY = "yeoyuro.token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Authorization 헤더 주입 헬퍼. 토큰 없으면 빈 객체.
 */
export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseErrorDetail(res) {
  try {
    const body = await res.json();
    return body?.detail;
  } catch {
    return null;
  }
}

/**
 * @param {{ email: string, password: string, nickname: string }} params
 */
export async function signup({ email, password, nickname }) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, nickname }),
  });
  if (!res.ok) {
    throw new Error((await parseErrorDetail(res)) ?? `signup ${res.status}`);
  }
  const data = await res.json();
  setToken(data.access_token);
  return data.user;
}

/**
 * @param {{ email: string, password: string }} params
 */
export async function login({ email, password }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error((await parseErrorDetail(res)) ?? `login ${res.status}`);
  }
  const data = await res.json();
  setToken(data.access_token);
  return data.user;
}

/**
 * 부팅 시 토큰 복원용. 401이면 토큰을 지우고 던진다.
 */
export async function me() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) {
    clearToken();
    throw new Error("인증이 만료되었습니다");
  }
  if (!res.ok) {
    throw new Error(`me ${res.status}`);
  }
  return res.json();
}

export function logout() {
  clearToken();
}
