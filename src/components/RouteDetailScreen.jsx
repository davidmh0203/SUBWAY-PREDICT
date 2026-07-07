import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrainCongestionList } from "@/components/TrainCongestionList";
import { RouteSchematic } from "@/components/RouteSchematic";
import { RouteMiniMap } from "@/components/RouteMiniMap";
import { getTrainCongestionRows } from "@/lib/crowd-data";
import { isSeoulMetroStation } from "@/lib/seoul-metro-stations";
import { useRouteCollapse } from "@/hooks/useRouteCollapse";

export function RouteDetailScreen({ route, departureTime, onBack }) {
  const timeOffset =
    departureTime.getHours() * 60 + departureTime.getMinutes() - (18 * 60 + 30);

  const stationNames = useMemo(() => {
    if (route.segments?.length) {
      return route.segments.flatMap((seg) => seg.stations.map((s) => s.name));
    }
    return route.stations ?? [];
  }, [route.segments, route.stations]);
  const trainRows = useMemo(
    () => getTrainCongestionRows(timeOffset, stationNames),
    [timeOffset, stationNames],
  );

  const { expandedGroups, toggleGroup } = useRouteCollapse(route.segments);
  const nonSeoulStations = stationNames.filter((name) => !isSeoulMetroStation(name));

  const dangerStation = route.stationPredictions.find(
    (p) => p.trigger === "KOPIS_EVENT" || p.congestionRate >= 120,
  );

  return (
    <div className="animate-fade-in space-y-5 pb-24">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-slate-800">경로 상세</h1>
          <p className="truncate text-xs text-slate-500">{route.stations.join(" → ")}</p>
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

      <div className="space-y-5 md:grid md:grid-cols-2 md:gap-5 md:space-y-0">
        <div className="space-y-5">
          {route.segments?.length > 0 && (
            <Card>
              <CardContent className="p-4 pt-5">
                <p className="mb-4 text-xs font-semibold text-slate-500">경로 다이어그램</p>
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
              <TrainCongestionList
                rows={trainRows}
                departureTime={departureTime}
                segments={route.segments}
                expandedGroups={expandedGroups}
                onToggleGroup={toggleGroup}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent className="p-4 pt-5">
              <p className="mb-3 text-xs font-semibold text-slate-500">경로 미니맵</p>
              <RouteMiniMap stationIds={stationNames} segments={route.segments} />
            </CardContent>
          </Card>

          {dangerStation && (
            <Card className="bg-slate-50 shadow-[inset_0_1px_3px_rgba(15,23,42,0.04)]">
              <CardContent className="p-4">
                <p className="mb-1 text-xs font-medium text-slate-500">대안 안내</p>
                <p className="text-sm leading-relaxed text-slate-700">
                  {dangerStation.stationName}역에서 하차 후 4분 뒤 다음 열차를 이용하면 혼잡도가{" "}
                  <strong className="text-emerald-700">약 40% 감소</strong>합니다.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
