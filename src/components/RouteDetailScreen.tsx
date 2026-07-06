import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CarCongestionHeatmap } from "@/components/CarCongestionHeatmap";
import { getCarCongestionRows } from "@/lib/crowd-data";
import type { RoutePath } from "@/lib/types";

interface RouteDetailScreenProps {
  route: RoutePath;
  departureTime: Date;
  onBack: () => void;
}

export function RouteDetailScreen({ route, departureTime, onBack }: RouteDetailScreenProps) {
  const timeOffset = departureTime.getHours() * 60 + departureTime.getMinutes() - (18 * 60 + 30);
  const carRows = useMemo(() => getCarCongestionRows(timeOffset), [timeOffset]);

  const dangerStation = route.stationPredictions.find(
    (p) => p.trigger === "KOPIS_EVENT" || p.congestionRate >= 120,
  );

  return (
    <div className="animate-fade-in space-y-5 pb-24">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-semibold text-slate-800">경로 상세</h1>
          <p className="text-xs text-slate-500">{route.stations.join(" → ")}</p>
        </div>
      </header>

      <Card>
        <CardContent className="p-4 pt-5">
          <CarCongestionHeatmap rows={carRows} departureTime={departureTime} />
        </CardContent>
      </Card>

      {dangerStation && (
        <Card className="bg-slate-50 shadow-[inset_0_1px_3px_rgba(15,23,42,0.04)]">
          <CardContent className="p-4">
            <p className="mb-1 text-xs font-medium text-slate-500">대안 안내</p>
            <p className="text-sm leading-relaxed text-slate-700">
              {dangerStation.stationName}역에서 하차 후 4분 뒤 다음 열차를 이용하면
              혼잡도가 <strong className="text-emerald-700">약 40% 감소</strong>합니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
