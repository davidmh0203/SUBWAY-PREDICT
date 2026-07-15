import { ArrowLeft, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { HourlyCongestionChart } from "@/components/HourlyCongestionChart";
import { RouteOptionCard } from "@/components/RouteOptionCard";
import { getHourlyCongestionData } from "@/lib/crowd-data";
import { buildRoutes, dateToSliderIndex, sliderIndexToDate } from "@/lib/mock-data";
import {
  buildSliderMarksAround,
  resolveEffectiveDeparture,
} from "@/lib/departure-time";
import {
  fetchBatchCongestion,
  fetchHourlyCongestion,
  fetchRoutesFromApi,
} from "@/lib/api/client";
import {
  applyCongestionMapToRoutes,
  collectStationNamesFromRoutes,
} from "@/lib/api/apply-congestion";
import { rankRoutes } from "@/lib/route-rank";
import { CongestionLegend } from "@/components/CongestionLegend";
import { formatHHMM } from "@/lib/route-timing";

export function RouteResultsScreen({
  form,
  onBack,
  onSelectRoute,
  onTimeChange,
  user = null,
  favorites = [],
  onToggleFavorite,
}) {
  const resolved = useMemo(
    () => resolveEffectiveDeparture(form.targetTime),
    [form.targetTime],
  );
  const sliderMarks = useMemo(
    () => buildSliderMarksAround(resolved.effective),
    [resolved.effective],
  );

  const [sliderIndex, setSliderIndex] = useState(() =>
    dateToSliderIndex(resolved.effective, sliderMarks),
  );
  const [debouncedTime, setDebouncedTime] = useState(resolved.effective);
  const [sliderLoading, setSliderLoading] = useState(false);
  const [baseRoutes, setBaseRoutes] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [congestionLoading, setCongestionLoading] = useState(false);
  const [hourlyData, setHourlyData] = useState(() =>
    getHourlyCongestionData(resolved.effective.getHours()),
  );
  const [hourlySource, setHourlySource] = useState("mock");

  const depName = form.departure.replace(/역.*$/, "");
  const destName = form.destination.replace(/역.*$/, "");
  const [direction, setDirection] = useState(`${destName} 방면`);

  // 경로(ODsay)는 화면 진입 시·OD 변경 시 1회 — 유효 출발(첫차 폴백 포함)
  const searchTimeRef = useRef(resolved.effective);

  useEffect(() => {
    searchTimeRef.current = resolved.effective;
    const marks = buildSliderMarksAround(resolved.effective);
    const idx = dateToSliderIndex(resolved.effective, marks);
    setSliderIndex(idx);
    setDebouncedTime(resolved.effective);
  }, [resolved.effective, resolved.mode]);

  useEffect(() => {
    setSliderLoading(true);
    const timer = setTimeout(() => {
      const next = sliderIndexToDate(
        sliderIndex,
        searchTimeRef.current,
        sliderMarks,
      );
      setDebouncedTime(next);
      onTimeChange(next);
      setSliderLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [sliderIndex, sliderMarks, onTimeChange]);

  useEffect(() => {
    let cancelled = false;
    setRoutesLoading(true);
    const fetchTime = searchTimeRef.current;

    (async () => {
      try {
        const apiRoutes = await fetchRoutesFromApi(depName, destName, fetchTime);
        if (cancelled) return;
        if (apiRoutes.length > 0) {
          setBaseRoutes(apiRoutes);
          setRoutes(apiRoutes);
        } else {
          const localRoutes = buildRoutes(fetchTime, depName, destName);
          setBaseRoutes(localRoutes);
          setRoutes(localRoutes);
        }
      } catch {
        if (cancelled) return;
        const localRoutes = buildRoutes(fetchTime, depName, destName);
        setBaseRoutes(localRoutes);
        setRoutes(localRoutes);
      } finally {
        if (!cancelled) setRoutesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [depName, destName, resolved.effective.getTime()]);

  // 시간대 차트: ODsay 없이 모델만 — 선택(유효) 날짜 기준
  useEffect(() => {
    let cancelled = false;
    const day = searchTimeRef.current;
    (async () => {
      try {
        const { points, source } = await fetchHourlyCongestion(depName, day);
        if (cancelled) return;
        setHourlyData(points);
        setHourlySource(source);
      } catch {
        if (cancelled) return;
        setHourlyData(getHourlyCongestionData(day.getHours()));
        setHourlySource("mock");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [depName, resolved.effective.getTime()]);

  // 슬라이더 시각 → 경로 카드 혼잡만 모델로 재계산 (ODsay 없음)
  useEffect(() => {
    if (!baseRoutes.length) return;
    let cancelled = false;
    const names = collectStationNamesFromRoutes(baseRoutes);
    if (!names.length) return;

    setCongestionLoading(true);
    (async () => {
      try {
        const { byName } = await fetchBatchCongestion(
          names,
          debouncedTime,
        );
        if (cancelled) return;
        setRoutes(applyCongestionMapToRoutes(baseRoutes, byName));
      } catch {
        // 실패 시 기존 경로 혼잡 유지
      } finally {
        if (!cancelled) setCongestionLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseRoutes, debouncedTime]);

  useEffect(() => {
    setDirection(`${destName} 방면`);
  }, [destName]);

  const loading = sliderLoading || congestionLoading;
  const activeHour = debouncedTime.getHours();
  const isFirstTrain = resolved.mode === "first-train";
  const rankedRoutes = useMemo(() => rankRoutes(routes), [routes]);

  // 즐겨찾기 식별자는 (출발, 도착, route_key, 출발 시각)까지 봐야 한다 —
  // 같은 경로라도 시각이 다르면(출근/퇴근) 별개의 즐겨찾기이기 때문.
  // form.targetTime이 아니라 searchTimeRef를 쓰는 이유: 위 슬라이더 useEffect가
  // (17:30~19:30 중 가장 가까운 값으로 스냅한 뒤) onTimeChange로 form.targetTime을
  // 되돌려 써버려서, 08:00처럼 슬라이더 범위 밖 시각으로 검색해도 실제 검색 시각과
  // 다른 값으로 즐겨찾기되는 문제가 있었다. searchTimeRef는 화면 진입 시의 실제
  // 검색 시각을 그대로 유지한다.
  const searchDepTimeStr = formatHHMM(searchTimeRef.current);
  const isRouteFavorited = (route) =>
    Boolean(user) &&
    favorites.some(
      (f) =>
        f.start_name === depName &&
        f.end_name === destName &&
        f.route_key === route.routeKey &&
        f.departure_time === searchDepTimeStr,
    );
  const isFavoriteDisabled = (route) =>
    Boolean(user) && !isRouteFavorited(route) && favorites.length >= 5;

  return (
    <div className="animate-fade-in space-y-5 pb-24">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-xs text-slate-500">경로 검색 결과</p>
          <h1 className="font-semibold text-slate-800">
            {form.departure} → {form.destination}
          </h1>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4 pt-5">
          <div className="flex items-center justify-between gap-2">
            {isFirstTrain ? (
              <p className="text-xs text-amber-700">
                선택 시각은 운행 종료 구간이라{" "}
                <strong>첫차(약 05:30)</strong> 기준으로 안내합니다.
              </p>
            ) : (
              <span />
            )}
            {loading && (
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
            )}
          </div>

          <div className="flex justify-between px-1 text-xs tabular-nums text-slate-400">
            {sliderMarks.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className={i === sliderIndex ? "font-bold text-slate-800" : ""}
              >
                {t}
              </span>
            ))}
          </div>
          <Slider
            min={0}
            max={sliderMarks.length - 1}
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
            dataSource={hourlySource}
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-600">추천 경로</h2>
          <CongestionLegend compact />
        </div>
        {routesLoading && routes.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              경로를 불러오는 중...
            </CardContent>
          </Card>
        ) : rankedRoutes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              검색된 경로가 없습니다.
            </CardContent>
          </Card>
        ) : (
          rankedRoutes.map(({ route, badges }) => {
            const baseTime = rankedRoutes[0]?.route.totalTime ?? route.totalTime;
            const timeDiff = route.totalTime - baseTime;
            return (
              <RouteOptionCard
                key={route.id}
                route={route}
                departureTime={debouncedTime}
                badges={badges}
                scheduleTag={isFirstTrain ? "첫차" : null}
                timeDiff={timeDiff}
                onClick={() => onSelectRoute(route)}
                isFavorited={isRouteFavorited(route)}
                favoriteDisabled={isFavoriteDisabled(route)}
                onToggleFavorite={
                  onToggleFavorite
                    ? () =>
                        onToggleFavorite(route, {
                          startName: depName,
                          endName: destName,
                          departureTime: searchTimeRef.current,
                        })
                    : undefined
                }
              />
            );
          })
        )}
      </section>
    </div>
  );
}
