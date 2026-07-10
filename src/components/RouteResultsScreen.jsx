import { ArrowLeft, Clock, Coins, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { HourlyCongestionChart } from "@/components/HourlyCongestionChart";
import { CROWD_LABELS, rateToCrowdLevel } from "@/lib/congestion";
import { getHourlyCongestionData } from "@/lib/crowd-data";
import {
  SLIDER_MARKS,
  buildRoutes,
  dateToSliderIndex,
  sliderIndexToDate,
} from "@/lib/mock-data";
import { fetchRoutesFromApi } from "@/lib/api/client";

export function RouteResultsScreen({
  form,
  onBack,
  onSelectRoute,
  onTimeChange,
}) {
  const [sliderIndex, setSliderIndex] = useState(() =>
    dateToSliderIndex(form.targetTime),
  );
  const [debouncedTime, setDebouncedTime] = useState(form.targetTime);
  const [sliderLoading, setSliderLoading] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routeSource, setRouteSource] = useState(null);
  const depName = form.departure.replace(/역.*$/, "");
  const destName = form.destination.replace(/역.*$/, "");
  const [direction, setDirection] = useState(`${destName} 방면`);

  useEffect(() => {
    setSliderLoading(true);
    const timer = setTimeout(() => {
      const next = sliderIndexToDate(sliderIndex, form.targetTime);
      setDebouncedTime(next);
      onTimeChange(next);
      setSliderLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [sliderIndex, form.targetTime, onTimeChange]);

  // ODsay /predict/route는 출발·도착·검색 시각 기준 1회만 호출 (슬라이더 조절 시 재호출 안 함)
  useEffect(() => {
    let cancelled = false;
    setRoutesLoading(true);
    const fetchTime = form.targetTime;

    (async () => {
      try {
        const apiRoutes = await fetchRoutesFromApi(
          depName,
          destName,
          fetchTime,
        );
        if (cancelled) return;
        const localRoutes = buildRoutes(fetchTime, depName, destName);
        const apiStops = Math.max(
          ...apiRoutes.map((r) => r.stations?.length ?? 0),
          0,
        );
        const localStops = Math.max(
          ...localRoutes.map((r) => r.stations?.length ?? 0),
          0,
        );
        if (localStops > apiStops) {
          setRoutes(localRoutes);
          setRouteSource("mock-graph");
        } else {
          setRoutes(apiRoutes);
          setRouteSource("api");
        }
      } catch {
        if (cancelled) return;
        setRoutes(buildRoutes(fetchTime, depName, destName));
        setRouteSource("mock");
      } finally {
        if (!cancelled) setRoutesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [depName, destName, form.targetTime]);

  useEffect(() => {
    setDirection(`${destName} 방면`);
  }, [destName]);

  const loading = sliderLoading;
  const activeHour = debouncedTime.getHours();
  const hourlyData = useMemo(
    () => getHourlyCongestionData(activeHour),
    [activeHour],
  );

  return (
    <div className="animate-fade-in space-y-5 pb-24">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          {/*  뒤로가기 버튼 */}
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-xs text-slate-500">경로 검색 결과</p>
          <h1 className="font-semibold text-slate-800">
            {form.departure} → {form.destination}
            {/* props로  부모 컴포넌트에게 받는 form  */}
            {/*  출발지 -> 목적지  */}
            {/* 꼭 이 {}로 묶어야 거기에 변수가 동적으로 들어가는건가 */}
          </h1>
        </div>
      </header>
      {/* 헤드 -> 상단 네비게이션바? 뒤로가기 */}

      <Card>
        <CardContent className="space-y-4 p-4 pt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              출발 시각을 조절하면 아래 차트가 갱신됩니다
            </p>
            {loading && (
              <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>

          <div className="flex justify-between px-1 text-xs tabular-nums text-slate-400">
            {SLIDER_MARKS.map((t, i) => (
              <span
                key={t}
                className={i === sliderIndex ? "font-bold text-slate-800" : ""}
              >
                {t}
              </span>
            ))}
          </div>
          <Slider
            min={0}
            max={SLIDER_MARKS.length - 1}
            step={1}
            value={[sliderIndex]}
            onValueChange={([v]) => setSliderIndex(v)}
          />

          <HourlyCongestionChart
            data={hourlyData}
            activeHour={activeHour}
            stationName={depName}
            lineName={routes[0]?.lineName ?? "2호선"}
            direction={direction}
            onDirectionSwap={() =>
              setDirection((d) =>
                d === `${destName} 방면`
                  ? `${depName} 방면`
                  : `${destName} 방면`,
              )
            }
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600">추천 경로</h2>
          {routeSource && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              {routeSource === "api" ? "API" : "목업"}
            </span>
          )}
        </div>
        {routesLoading && routes.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              경로를 불러오는 중...
            </CardContent>
          </Card>
        ) : (
          routes.map((route, idx) => {
            const crowdLevel = rateToCrowdLevel(route.maxCongestion);
            const baseTime = routes[0]?.totalTime ?? route.totalTime;
            const timeDiff = route.totalTime - baseTime;
            return (
              <Card
                key={route.id}
                className={`cursor-pointer transition-shadow duration-300 hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.07)] ${route.recommended ? "shadow-[0_2px_8px_rgba(15,23,42,0.08)]" : ""}`}
                onClick={() => onSelectRoute(route)}
              >
                <CardContent className="p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      {route.label ?? (idx === 0 ? "최단 시간" : "대안 경로")}
                    </span>
                    <Badge variant="primary">{route.badge}</Badge>
                    {route.recommended && (
                      <Badge variant="smooth" className="ml-auto">
                        추천
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {route.totalTime}분
                      {timeDiff > 0 && (
                        <span className="text-slate-400">(+{timeDiff}분)</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" />
                      {route.payment.toLocaleString()}원
                    </span>
                    <span>
                      {route.lineName} · 환승 {route.transfers}회
                    </span>
                  </div>

                  {route.description && (
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {route.description}
                    </p>
                  )}

                  <p className="mt-2 text-sm text-slate-500">
                    혼잡도{" "}
                    <strong className="text-slate-700">
                      {CROWD_LABELS[crowdLevel]}
                    </strong>{" "}
                    (최대 {route.maxCongestion}%)
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
