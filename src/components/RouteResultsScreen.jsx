import { ArrowLeft, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { HourlyCongestionChart } from "@/components/HourlyCongestionChart";
import { RouteOptionCard } from "@/components/RouteOptionCard";
import { buildSliderMarksAround, resolveEffectiveDeparture } from "@/lib/departure-time";
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
import {
  DEFAULT_ROUTE_CARD_STYLE,
  readRouteCardStyle,
} from "@/lib/route-card-styles";
import { CongestionLegend } from "@/components/CongestionLegend";
import { formatHHMM } from "@/lib/route-timing";
import { getHourlyCongestionData } from "@/lib/crowd-data";
import { dateToSliderIndex, sliderIndexToDate } from "@/lib/mock-data";

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
  const [routesError, setRoutesError] = useState(null);
  const [congestionLoading, setCongestionLoading] = useState(false);
  const [hourlyData, setHourlyData] = useState(() =>
    getHourlyCongestionData(resolved.effective.getHours()),
  );
  const [hourlySource, setHourlySource] = useState("mock");
  const [reloadToken, setReloadToken] = useState(0);

  const depName = form.departure.replace(/역.*$/, "");
  const destName = form.destination.replace(/역.*$/, "");
  const [direction, setDirection] = useState(`${destName} 방면`);

  const searchTimeRef = useRef(resolved.effective);
  const prevSliderIndexRef = useRef(null);

  useEffect(() => {
    searchTimeRef.current = resolved.effective;
    const marks = buildSliderMarksAround(resolved.effective);
    const idx = dateToSliderIndex(resolved.effective, marks);
    setSliderIndex(idx);
    setDebouncedTime(resolved.effective);
  }, [resolved.effective, resolved.mode]);

  // 슬라이더를 사용자가 움직일 때만 디바운스·스피너. 마운트/시각 동기화는 조용히 반영.
  useEffect(() => {
    const next = sliderIndexToDate(
      sliderIndex,
      searchTimeRef.current,
      sliderMarks,
    );
    const prevIdx = prevSliderIndexRef.current;
    prevSliderIndexRef.current = sliderIndex;

    // 최초 마운트·검색 시각 동기화(인덱스 동일)는 스피너 없이 반영
    if (prevIdx === null || prevIdx === sliderIndex) {
      setDebouncedTime(next);
      setSliderLoading(false);
      return;
    }

    setSliderLoading(true);
    const timer = setTimeout(() => {
      setDebouncedTime(next);
      onTimeChange(next);
      setSliderLoading(false);
    }, 400);
    return () => {
      clearTimeout(timer);
      setSliderLoading(false);
    };
  }, [sliderIndex, sliderMarks, onTimeChange]);

  useEffect(() => {
    let cancelled = false;
    setRoutesLoading(true);
    setRoutesError(null);
    setBaseRoutes([]);
    setRoutes([]);
    const fetchTime = searchTimeRef.current;

    (async () => {
      try {
        const apiRoutes = await fetchRoutesFromApi(depName, destName, fetchTime);
        if (cancelled) return;
        if (apiRoutes.length > 0) {
          setBaseRoutes(apiRoutes);
          setRoutes(apiRoutes);
          setRoutesError(null);
        } else {
          setRoutesError("검색된 경로가 없습니다.");
        }
      } catch (err) {
        if (cancelled) return;
        // 로컬 단순 경로(출발/도착만)로 조용히 대체하지 않음
        const msg = err instanceof Error ? err.message : String(err);
        const detail = err?.detail || msg;
        let friendly =
          "경로를 불러오지 못했습니다. 경로 탐색(ODsay)에 문제가 있어요.";
        if (/1\s*~\s*8호선|미지원|신분당/i.test(detail) || err?.status === 422) {
          friendly =
            detail.replace(/^predict\/route \d+:\s*/i, "").trim() ||
            "1~8호선만으로 이동 가능한 경로가 없습니다. (9호선·신분당선 미지원)";
        } else if (/Failed to fetch|NetworkError|timeout|AbortError/i.test(msg)) {
          friendly =
            "서버에 연결하지 못했습니다. 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.";
        } else if (/ODsay|경로 탐색|불완전/i.test(detail)) {
          friendly =
            detail.replace(/^predict\/route \d+:\s*/i, "").trim() || friendly;
        } else if (/503|502|Bad Gateway|Service Unavailable/i.test(msg)) {
          friendly =
            "서버 또는 경로 탐색(ODsay)에 실패했습니다. Render가 잠들었거나 과부하일 수 있어요. 잠시 후 다시 시도해 주세요.";
        }
        setRoutesError(friendly);
      } finally {
        if (!cancelled) setRoutesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [depName, destName, resolved.effective.getTime(), reloadToken]);

  // 시간대 차트: 경로 로드 성공 후에만 (동시 폭주로 Free 인스턴스 502 방지)
  useEffect(() => {
    if (routesLoading || routesError || !baseRoutes.length) return;
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
  }, [depName, routesLoading, routesError, baseRoutes, resolved.effective.getTime()]);

  // 슬라이더로 검색 시각과 달라질 때만 batch (초기 로드는 predict/route 혼잡 사용)
  useEffect(() => {
    if (!baseRoutes.length || routesError) return;
    const searchMs = searchTimeRef.current.getTime();
    if (Math.abs(debouncedTime.getTime() - searchMs) < 60_000) {
      setRoutes(baseRoutes);
      return;
    }

    let cancelled = false;
    const names = collectStationNamesFromRoutes(baseRoutes);
    if (!names.length) return;

    setCongestionLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { byName } = await fetchBatchCongestion(names, debouncedTime);
        if (cancelled) return;
        setRoutes(applyCongestionMapToRoutes(baseRoutes, byName));
      } catch {
        // 실패 시 기존 경로 혼잡 유지
      } finally {
        if (!cancelled) setCongestionLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setCongestionLoading(false);
    };
  }, [baseRoutes, debouncedTime, routesError]);

  useEffect(() => {
    setDirection(`${destName} 방면`);
  }, [destName]);

  const loading = sliderLoading || congestionLoading;
  const activeHour = debouncedTime.getHours();
  const isFirstTrain = resolved.mode === "first-train";
  const rankedRoutes = useMemo(() => rankRoutes(routes), [routes]);
  const cardStyleId = import.meta.env.DEV
    ? readRouteCardStyle()
    : DEFAULT_ROUTE_CARD_STYLE;

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
          {routesError ? (
            <p className="text-sm text-amber-800">
              경로를 불러오지 못해 시간대 혼잡 차트는 표시하지 않습니다.
            </p>
          ) : (
            <>
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
            lineName={routes[0]?.lineName ?? "지하철"}
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
            </>
          )}
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
              <span className="block w-full text-center text-xs text-slate-400">
                서버가 잠에서 깨는 중이면 최대 1분 걸릴 수 있어요.
              </span>
            </CardContent>
          </Card>
        ) : routesError ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-center text-sm text-slate-600">
              <p>{routesError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReloadToken((n) => n + 1)}
              >
                다시 시도
              </Button>
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
                cardStyleId={cardStyleId}
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
