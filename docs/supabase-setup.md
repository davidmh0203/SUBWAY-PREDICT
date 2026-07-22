# Supabase 인증·즐겨찾기 설정

팀원마다 로컬 MySQL/SQLite 백엔드가 달라 로그인이 안 되는 문제를 피하려면, 프론트에서 **Supabase Auth**를 쓰면 됩니다.  
`VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`가 **둘 다** 있으면 FastAPI `/auth`, `/favorites` 대신 Supabase를 사용합니다. 없으면 기존 백엔드 JWT 방식 그대로입니다.

## 1. Supabase 프로젝트

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. **Authentication → Providers → Email** 활성화
3. 데모용이면 **Confirm email** 끄기 (끄지 않으면 가입 후 이메일 인증 필요)
4. **Project Settings → API**에서 URL, `anon` public key 복사

## 2. 로컬 `.env`

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_KAKAO_MAP_API_KEY=...   # 지도용 JavaScript 키 (소셜 로그인과 별개)
```

Vercel 배포 시에도 동일 변수를 **Environment Variables**에 등록합니다.

## 3. 카카오 소셜 로그인 (선택)

앱 로그인 화면에 **카카오로 계속하기**가 있습니다. Supabase OAuth + 카카오 로그인을 연결해야 동작합니다.

### 3-1. 카카오 개발자

1. [developers.kakao.com](https://developers.kakao.com) → 앱 선택 (REST 키를 쓰는 앱)
2. **제품 설정 → 카카오 로그인 → 활성화 ON**
3. **카카오 로그인 → Redirect URI**에 등록:

```text
https://<PROJECT_REF>.supabase.co/auth/v1/callback
```

예: `https://zeeetqkqpcahjntbkwbc.supabase.co/auth/v1/callback`

4. **앱 키**에서 **REST API 키**(Client ID), **Client Secret** 발급/확인  
   (Client Secret은 카카오 로그인 보안 설정에서 생성)

### 3-2. Supabase

1. **Authentication → Providers → Kakao** → Enable
2. Client ID = 카카오 REST API 키  
3. Client Secret = 카카오 Client Secret  
4. **Authentication → URL Configuration**
   - Site URL: `https://subway-predict-dashboard.vercel.app`
   - Redirect URLs에 추가:
     - `https://subway-predict-dashboard.vercel.app/**`
     - `http://localhost:5173/**`

### 3-3. 확인

배포/로컬에서 로그인 → **카카오로 계속하기** → 카카오 동의 → 앱으로 돌아오며 로그인.

## 4. 즐겨찾기 테이블 (SQL Editor)

```sql
create table if not exists public.favorite_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  start_name text not null,
  end_name text not null,
  route_key text not null,
  route_label text not null,
  departure_time text not null,
  created_at timestamptz not null default now(),
  unique (user_id, start_name, end_name, route_key, departure_time)
);

alter table public.favorite_routes enable row level security;

create policy "Users read own favorites"
  on public.favorite_routes for select
  using (auth.uid() = user_id);

create policy "Users insert own favorites"
  on public.favorite_routes for insert
  with check (auth.uid() = user_id);

create policy "Users delete own favorites"
  on public.favorite_routes for delete
  using (auth.uid() = user_id);
```

## 5. 확인

```bash
npm run dev
```

1. 홈 → 로그인/회원가입 (또는 카카오)
2. 경로 검색 후 별표 즐겨찾기
3. 즐겨찾기 탭에서 목록 확인

Supabase **Table Editor**에서 `favorite_routes` 행이 생기면 성공입니다.

## 참고

- 혼잡도·경로 API는 여전히 FastAPI(`/api`) 또는 목업을 사용합니다. Supabase는 **회원·즐겨찾기만** 담당합니다.
- 프로덕션에서 이메일 인증을 켜려면 Supabase 대시보드에서 Confirm email을 켜고, 앱의 `signup` 오류 메시지(이메일 인증 안내)를 그대로 사용자에게 보여주면 됩니다.
- 지도용 `VITE_KAKAO_MAP_API_KEY`(JS)와 로그인용 REST 키/시크릿은 역할이 다릅니다.
