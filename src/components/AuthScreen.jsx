import { useState } from "react";
import { ArrowLeft, Train } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { login, signup } from "@/lib/api/auth";
import { APP_NAME } from "@/lib/app-brand";

const inputClass =
  "w-full rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)] outline-none transition focus:bg-white focus:shadow-[inset_0_1px_3px_rgba(15,23,42,0.08),0_0_0_2px_rgba(148,163,184,0.25)]";

export function AuthScreen({ onBack, onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
