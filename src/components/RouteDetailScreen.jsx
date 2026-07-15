import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrainCongestionList } from "@/components/TrainCongestionList";
import { RouteSchematic } from "@/components/RouteSchematic";
import { StationCongestionChart } from "@/components/StationCongestionChart";
import {
  RouteTimelineBar,
  buildTimelineLegs,
} from "@/components/RouteTimelineBar";
import { RouteCongestionStrip } from "@/components/RouteCongestionStrip";
import { rateToCrowdLevel } from "@/lib/congestion";
import { isSeoulMetroStation } from "@/lib/seoul-metro-stations";
import { useRouteCollapse } from "@/hooks/useRouteCollapse";
import { formatStationLabel } from "@/lib/station-name";

/** 모델/API 역별 예측 → 경로 혼잡 리스트 rows (칸별 아님) */
function buildCongestionRowsFromRoute(route) {
  if (route.stationPredictions?.length) {
    return route.stationPredictions.map((p) => ({
      stationName: p.stationName,
      overallRate: p.congestionRate,
      level: rateToCrowdLevel(p.congestionRate),
    }));
  }
  if (route.segments?.length) {
    return route.segments.flatMap((seg) =>
      seg.stations.map((s) => ({
        stationName: s.name,
        overallRate: s.congestionRate ?? 0,
        level: rateToCrowdLevel(s.congestionRate ?? 0),
      })),
    );
  }
  return [];
}

export function RouteDetailScreen({ route, departureTime, onBack }) {
  const stationNames = useMemo(() => {
    if (route.segments?.length) {
      return route.segments.flatMap((seg) => seg.stations.map((s) => s.name));
    }
    return route.stations ?? [];
  }, [route.segments, route.stations]);

  const trainRows = useMemo(() => buildCongestionRowsFromRoute(route), [route]);
  const timelineLegs = useMemo(() => buildTimelineLegs(route), [route]);

  const { expandedGroups, toggleGroup } = useRouteCollapse(route.segments);
  const nonSeoulStations = stationNames.filter(
    (name) => !isSeoulMetroStation(name),
  );

  const dangerStation = route.stationPredictions?.find(
    (p) => p.trigger === "KOPIS_EVENT" || p.congestionRate >= 100,
  );

  return (
    <div className="animate-fade-in space-y-5 pb-24">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-slate-800">경로 상세</h1>
          <p className="truncate text-xs text-slate-500">
            {route.stations.join(" → ")}
          </p>
          {nonSeoulStations.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {nonSeoulStations.map((name) => (
                <Badge key={name} variant="outline" className="text-[10px]">
                  {name} · 수도권 외
                </Badge>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="space-y-5">
        {route.segments?.length > 0 && (
          <Card>
            <CardContent className="p-4 pt-5">
              <p className="mb-3 text-xs font-semibold text-slate-500">
                소요 시간
              </p>
              <RouteTimelineBar
                legs={timelineLegs}
                totalTime={route.totalTime}
              />
              <RouteCongestionStrip route={route} className="mt-3" />
              <p className="mb-4 mt-5 text-xs font-semibold text-slate-500">
                경로 다이어그램
              </p>
              <RouteSchematic
                segments={route.segments}
                expandedGroups={expandedGroups}
                onToggleGroup={toggleGroup}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4 pt-5">
            <StationCongestionChart
              route={route}
              departureTime={departureTime}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 pt-5">
            <TrainCongestionList
              rows={trainRows}
              departureTime={departureTime}
              segments={route.segments}
            />
          </CardContent>
        </Card>

        {dangerStation && (
          <Card className="bg-slate-50 shadow-[inset_0_1px_3px_rgba(15,23,42,0.04)]">
            <CardContent className="p-4">
              <p className="mb-1 text-xs font-medium text-slate-500">
                대안 안내
              </p>
              <p className="text-sm leading-relaxed text-slate-700">
                {formatStationLabel(dangerStation.stationName)}에서 하차 후 4분 뒤
                다음 열차를
                이용하면 혼잡도가{" "}
                <strong className="text-emerald-700">약 40% 감소</strong>
                합니다.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
