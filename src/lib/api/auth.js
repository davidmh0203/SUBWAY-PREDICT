import { getSupabase, isSupabaseAuthEnabled } from "@/lib/supabase-client";

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

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isUsingSupabaseAuth() {
  return isSupabaseAuthEnabled;
}

async function parseErrorDetail(res) {
  try {
    const body = await res.json();
    return body?.detail;
  } catch {
    return null;
  }
}

function mapSupabaseUser(user, nickname) {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? "",
    nickname:
      nickname ??
      meta.nickname ??
      meta.full_name ??
      meta.name ??
      meta.preferred_username ??
      user.email?.split("@")[0] ??
      "사용자",
  };
}

async function signupApi({ email, password, nickname }) {
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

async function loginApi({ email, password }) {
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

async function meApi() {
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

async function signupSupabase({ email, password, nickname }) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase가 설정되지 않았습니다");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("회원가입에 실패했습니다");

  if (!data.session) {
    throw new Error("이메일 인증 후 로그인해 주세요");
  }
  return mapSupabaseUser(data.user, nickname);
}

async function loginSupabase({ email, password }) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase가 설정되지 않았습니다");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("로그인에 실패했습니다");
  return mapSupabaseUser(data.user);
}

async function meSupabase() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session?.user) return null;
  return mapSupabaseUser(data.session.user);
}

export async function signup(params) {
  if (isSupabaseAuthEnabled) return signupSupabase(params);
  return signupApi(params);
}

export async function login(params) {
  if (isSupabaseAuthEnabled) return loginSupabase(params);
  return loginApi(params);
}

/**
 * 카카오 소셜 로그인 (Supabase OAuth).
 * 성공 시 카카오 → Supabase 콜백 → redirectTo 로 돌아온다.
 */
export async function loginWithKakao() {
  if (!isSupabaseAuthEnabled) {
    throw new Error("Supabase가 설정된 환경에서만 카카오 로그인을 사용할 수 있습니다");
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase가 설정되지 않았습니다");

  const redirectTo = `${window.location.origin}/`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo,
      skipBrowserRedirect: false,
    },
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function me() {
  if (isSupabaseAuthEnabled) return meSupabase();
  return meApi();
}

export async function logout() {
  if (isSupabaseAuthEnabled) {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    return;
  }
  clearToken();
}
