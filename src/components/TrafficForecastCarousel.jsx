import { useRef } from "react";
import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function bodyLines(evt) {
  if (Array.isArray(evt.lines) && evt.lines.length > 0) {
    return evt.lines.map(String).filter(Boolean);
  }
  const raw = String(evt.summary || "").trim();
  if (!raw) return [];
  const parts = raw
    .split(/(?<=[.!?다요음])\s+| · /)
    .map((p) => p.replace(/^·\s*/, "").trim())
    .filter(Boolean);
  return parts.length ? parts : [raw];
}

export function TrafficForecastCarousel({ events, loading = false }) {
  const scrollRef = useRef(null);
  const sorted = [...(events ?? [])].sort(
    (a, b) => a.priority - b.priority || b.impactScore - a.impactScore,
  );

  if (loading) {
    return (
      <section>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
          <Bell className="h-4 w-4" />
          오늘의 정체 예보
        </div>
        <Card className="min-w-[82%] bg-amber-50/40">
          <CardContent className="space-y-2 p-4 pt-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-amber-100/80" />
            <div className="h-3 w-full animate-pulse rounded bg-amber-100/60" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-amber-100/50" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-amber-100/40" />
          </CardContent>
        </Card>
      </section>
    );
  }

  if (sorted.length === 0) {
    return (
      <section>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
          <Bell className="h-4 w-4" />
          오늘의 정체 예보
        </div>
        <Card className="bg-amber-50/60">
          <CardContent className="p-4 pt-4">
            <p className="text-sm text-slate-600">
              예보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
        <Bell className="h-4 w-4" />
        오늘의 정체 예보
      </div>
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sorted.map((evt) => {
          const lines = bodyLines(evt);
          return (
            <Card
              key={evt.id}
              className="min-w-[82%] shrink-0 snap-start bg-amber-50/60 shadow-[inset_0_1px_3px_rgba(245,158,11,0.06),0_2px_12px_rgba(245,158,11,0.08)]"
            >
              <CardContent className="p-4 pt-4">
                <p className="text-sm font-semibold text-slate-800">
                  {evt.emoji && <span className="mr-1">{evt.emoji}</span>}
                  {evt.title}
                </p>
                {lines.length > 0 && (
                  <ul className="mt-2 space-y-1.5 text-sm leading-snug text-slate-700">
                    {lines.map((line, i) => (
                      <li key={`${evt.id}-l-${i}`} className="flex gap-2">
                        <span
                          className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-700/70"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 break-keep">{line}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {evt.highlight && (
                  <p className="mt-2.5 border-t border-amber-200/80 pt-2 text-sm font-medium leading-snug text-rose-700">
                    {evt.highlight}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {sorted.length > 1 && (
        <p className="mt-2 text-center text-[10px] text-slate-400">
          ← 좌우로 밀어서 더 보기 →
        </p>
      )}
    </section>
  );
}
