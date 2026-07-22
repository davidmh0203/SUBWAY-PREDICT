import { useState } from "react";
import { ArrowLeft, Train } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isUsingSupabaseAuth,
  login,
  loginWithKakao,
  signup,
} from "@/lib/api/auth";
import { APP_NAME } from "@/lib/app-brand";

const inputClass =
  "w-full rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)] outline-none transition focus:bg-white focus:shadow-[inset_0_1px_3px_rgba(15,23,42,0.08),0_0_0_2px_rgba(148,163,184,0.25)]";

function KakaoIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.58 2 10.9c0 2.78 1.86 5.22 4.66 6.6-.15.54-.96 3.48-.99 3.7 0 0-.2.12.01.24.08.05.18.01.18.01.24-.03 2.78-1.83 3.21-2.13.62.09 1.27.13 1.93.13 5.52 0 10-3.58 10-7.9S17.52 3 12 3z"
      />
    </svg>
  );
}

export function AuthScreen({ onBack, onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const showKakao = isUsingSupabaseAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user =
        mode === "login"
          ? await login({ email, password })
          : await signup({ email, password, nickname });
      onAuthSuccess(user);
    } catch (err) {
      setError(err.message || "요청에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKakao = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithKakao();
      // 카카오·Supabase로 리다이렉트됨
    } catch (err) {
      setError(err.message || "카카오 로그인에 실패했습니다");
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-5 pb-24">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Train className="h-5 w-5 text-slate-600" />
          <h1 className="font-semibold text-slate-800">{APP_NAME} 로그인</h1>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4 pt-5">
          {showKakao && (
            <div className="space-y-3">
              <Button
                type="button"
                size="lg"
                className="w-full gap-2 border-0 bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00] hover:text-[#191919]"
                disabled={submitting}
                onClick={handleKakao}
              >
                <KakaoIcon className="h-5 w-5" />
                {submitting ? "카카오로 이동 중..." : "카카오로 계속하기"}
              </Button>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                또는 이메일
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            </div>
          )}

          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v);
              setError(null);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">로그인</TabsTrigger>
              <TabsTrigger value="signup">회원가입</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form className="space-y-3 pt-2" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">이메일</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">비밀번호</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="비밀번호"
                  />
                </label>
                {error && <p className="text-xs text-rose-600">{error}</p>}
                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? "로그인 중..." : "로그인"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="space-y-3 pt-2" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">닉네임</span>
                  <input
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className={inputClass}
                    placeholder="닉네임"
                    maxLength={50}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">이메일</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">비밀번호</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="8자 이상"
                  />
                </label>
                {error && <p className="text-xs text-rose-600">{error}</p>}
                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? "가입 중..." : "회원가입"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
