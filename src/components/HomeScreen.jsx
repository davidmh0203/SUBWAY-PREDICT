import { Settings, MapPin, Train, LocateFixed } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TimeBottomSheet, TimePickerButton } from "@/components/TimeBottomSheet";
import { TrafficForecastCarousel } from "@/components/TrafficForecastCarousel";
import { StationSearchField } from "@/components/StationSearchField";
import { TODAY_EVENTS } from "@/lib/mock-data";
import { CROWD_LABELS } from "@/lib/congestion";
import { APP_NAME } from "@/lib/app-brand";

export function HomeScreen({
  form,
  onFormChange,
  onSearch,
  nearbyCongestion = [],
  locationState = "idle",
  onRequestLocation,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const canSearch = Boolean(form.departureStationId && form.destinationStationId);

  return (
    <div className="animate-fade-in space-y-5 pb-24">
      <header className="flex items-center justify-between px-1">
        <Button variant="ghost" size="icon" aria-label="설정">
          <Settings className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Train className="h-5 w-5 text-slate-600" />
          <h1 className="text-lg font-bold tracking-tight text-slate-800">{APP_NAME}</h1>
        </div>
        <div className="w-10" aria-hidden />
      </header>

      <TrafficForecastCarousel events={TODAY_EVENTS} />
      {/* 이벤트를 받아서 자식인 TrafficForecastCarousel에 던져준다 */}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-600">내 주변 역/열차 혼잡도</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={onRequestLocation}
          >
            <LocateFixed className="mr-1 h-3.5 w-3.5" />
            내 위치 갱신
          </Button>
        </div>
        <Card>
          <CardContent className="space-y-2 p-3">
            {locationState === "denied" && (
              <p className="text-xs text-rose-600">
                위치 권한이 필요합니다. 브라우저 권한을 허용해 주세요.
              </p>
            )}
            {locationState === "loading" && (
              <p className="text-xs text-slate-500">내 위치 기반 주변 역을 찾는 중...</p>
            )}
            {locationState !== "loading" && nearbyCongestion.length === 0 && (
              <p className="text-xs text-slate-500">
                위치를 불러오면 주변 역의 역 혼잡도/열차 혼잡도를 보여줍니다.
              </p>
            )}
            {nearbyCongestion.map((item) => (
              <div
                key={item.stationId}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <p className="text-sm font-semibold text-slate-800">{item.stationName}역</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600">
                  <span>
                    역 혼잡도: <strong>{item.stationRate}%</strong> ({CROWD_LABELS[item.stationLevel]})
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>
                    열차 혼잡도: <strong>{item.trainRate}%</strong> ({CROWD_LABELS[item.trainLevel]})
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-600">어디로 이동하시나요?</h2>
        <Card>
          <CardContent className="space-y-3 p-4">
            <StationSearchField
              label="출발"
              icon={MapPin}
              value={form.departure}
              stationId={form.departureStationId}
              excludeStationId={form.destinationStationId}
              onChange={({ text, stationId }) =>
                onFormChange({
                  ...form,
                  departure: text,
                  departureStationId: stationId,
                })
              }
            />
            <StationSearchField
              label="도착"
              value={form.destination}
              stationId={form.destinationStationId}
              excludeStationId={form.departureStationId}
              onChange={({ text, stationId }) =>
                onFormChange({
                  ...form,
                  destination: text,
                  destinationStationId: stationId,
                })
              }
            />
            <TimePickerButton value={form.targetTime} onClick={() => setSheetOpen(true)} />
            <Button size="lg" className="w-full" onClick={onSearch} disabled={!canSearch}>
              경로 예측 검색
            </Button>
            {!canSearch && (
              <p className="text-center text-[11px] text-slate-500">
                출발·도착 역을 목록에서 선택해 주세요
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <TimeBottomSheet
        open={sheetOpen}
        value={form.targetTime}
        onClose={() => setSheetOpen(false)}
        onConfirm={(targetTime) => onFormChange({ ...form, targetTime })}
      />
    </div>
  );
}
