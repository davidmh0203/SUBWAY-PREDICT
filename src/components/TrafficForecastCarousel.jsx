import { useRef } from "react";
import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function TrafficForecastCarousel({ events }) {
  // 부모인 HomeScreen.jsx에게  이벤트 데이터를 받는다. prop으로

  const scrollRef = useRef(null);
  //useRef: 렌더링ㅇ 필요하지 않은 값을 참조 할 수 있는 훅 -> ref 선언
  // ref: 컴포넌트가 일부정보를 기억하고 싶지만, 해당 정보가 렌더링을 유발하지 않도록
  //  ref 객체를 반환해준다 
  const sorted = [...events].sort( // 이벤트를 우선순위에따라 정렬
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
        //  스크롤 컨테이너를 참조하도록 
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sorted.map((evt) => ( 
          // 우선순위로 정렬된 이벤트들을 .map()으로 반복해서 각 이벤트들을  렌더링
          <Card
            key={evt.id}// sorted에 담긴 i번째 이벤트의 id
            className="min-w-[82%] shrink-0 snap-start bg-amber-50/60 shadow-[inset_0_1px_3px_rgba(245,158,11,0.06),0_2px_12px_rgba(245,158,11,0.08)]"
          >
            <CardContent className="p-4 pt-4">
              <p className="text-sm font-semibold text-slate-800">
                {evt.emoji && <span className="mr-1">{evt.emoji}</span>}
                {evt.title} 
                {/* sorted에 담긴 i번째 이벤트의 이모지와 제목 */}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                {evt.summary}
                {/* 이벤트 내용 */}
              </p>
              {evt.highlight && (
                <p className="mt-1 text-sm font-medium text-rose-700">
                  {evt.highlight}
                  {/* 이벤트 하이라이트 정보 */}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {sorted.length > 1 && (
        <p className="mt-2 text-center text-[10px] text-slate-400">
          ← 좌우로 밀어서 더 보기 →
        </p>
      )}
    </section>
  );
}
