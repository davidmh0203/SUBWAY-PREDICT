import { useRef } from "react";
import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function TrafficForecastCarousel({ events }) {
  const scrollRef = useRef(null);
  const sorted = [...events].sort(
    (a, b) => a.priority - b.priority || b.impactScore - a.impactScore,
  );

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
        {sorted.map((evt) => (
          <Card
            key={evt.id}
            className="min-w-[82%] shrink-0 snap-start bg-amber-50/60 shadow-[inset_0_1px_3px_rgba(245,158,11,0.06),0_2px_12px_rgba(245,158,11,0.08)]"
          >
            <CardContent className="p-4 pt-4">
              <p className="text-sm font-semibold text-slate-800">
                {evt.emoji && <span className="mr-1">{evt.emoji}</span>}
                {evt.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{evt.summary}</p>
              {evt.highlight && (
                <p className="mt-1 text-sm font-medium text-rose-700">{evt.highlight}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {sorted.length > 1 && (
        <p className="mt-2 text-center text-[10px] text-slate-400">← 좌우로 밀어서 더 보기 →</p>
      )}
    </section>
  );
}
