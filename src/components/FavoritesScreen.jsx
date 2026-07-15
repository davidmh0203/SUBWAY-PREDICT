import { useState } from "react";
import { ArrowRight, Clock, Loader2, Star, Train } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function FavoritesScreen({
  user,
  favorites = [],
  favoritesLoading = false,
  onRemoveFavorite,
  onOpenFavorite,
  onGoLogin,
}) {
  const [busyId, setBusyId] = useState(null);

  if (!user) {
    return (
      <div className="animate-fade-in space-y-5 pb-24">
        <header>
          <h1 className="text-lg font-bold text-slate-800">즐겨찾기</h1>
        </header>
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <p className="text-sm text-slate-500">
              로그인하면 자주 다니는 경로를 즐겨찾기로 저장할 수 있어요.
            </p>
            <Button onClick={onGoLogin}>로그인 / 회원가입</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleRemove = async (id) => {
    setBusyId(id);
    try {
      await onRemoveFavorite(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleOpen = async (favorite) => {
    setBusyId(favorite.id);
    try {
      await onOpenFavorite(favorite);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="animate-fade-in space-y-5 pb-24">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">즐겨찾기</h1>
        <span className="text-xs text-slate-400">{favorites.length}/5</span>
      </header>

      {favoritesLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            불러오는 중...
          </CardContent>
        </Card>
      ) : favorites.length === 0 ? (
        <Card>
          <CardContent className="space-y-1 p-8 text-center">
            <Train className="mx-auto h-6 w-6 text-slate-300" />
            <p className="text-sm text-slate-500">아직 즐겨찾기한 경로가 없어요.</p>
            <p className="text-xs text-slate-400">
              경로 검색 결과에서 별을 눌러 추가해보세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {favorites.map((f) => {
            const busy = busyId === f.id;
            return (
              <div
                key={f.id}
                role="button"
                tabIndex={0}
                onClick={() => !busy && handleOpen(f)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !busy) {
                    e.preventDefault();
                    handleOpen(f);
                  }
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:shadow-[0_2px_8px_rgba(15,23,42,0.08)] aria-disabled:opacity-60"
                aria-disabled={busy}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <span className="truncate">{f.start_name}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                    <span className="truncate">{f.end_name}</span>
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3 shrink-0 text-slate-400" />
                    {f.departure_time} 출발
                    <span className="text-slate-300">·</span>
                    {f.route_label}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <button
                      type="button"
                      aria-label="즐겨찾기 해제"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(f.id);
                      }}
                      className="rounded-lg p-1.5 transition hover:bg-slate-50"
                    >
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
