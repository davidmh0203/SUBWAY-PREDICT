import { useMemo, useState } from "react";
import { LocateFixed, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractiveMetroMap } from "@/components/InteractiveMetroMap";
import { MapScreen } from "@/components/MapScreen";
import { MapViewModeToggle } from "@/components/MapViewModeToggle";
import { SLIDER_MARKS, dateToSliderIndex, sliderIndexToDate } from "@/lib/mock-data";
import { formatTime } from "@/lib/congestion";
import { getNearestStationsByGeo } from "@/lib/metro-network";
import { sameStation } from "@/lib/station-id";
import { formatStationLabel } from "@/lib/station-name";

function timeChipFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return SLIDER_MARKS[2];
  const idx = dateToSliderIndex(date, SLIDER_MARKS);
  return SLIDER_MARKS[idx] ?? SLIDER_MARKS[2];
}

export function MacroViewScreen({
  form,
  onFormChange,
  onSearch,
  geoLocation,
  locationState,
  onRequestLocation,
  initialMapViewMode = "schematic",
}) {
  const selectedTime = timeChipFromDate(form.targetTime);
  const [pickRole, setPickRole] = useState("departure");
  const [focusStationId, setFocusStationId] = useState(null);
  const [mapViewMode, setMapViewMode] = useState(initialMapViewMode);

  const handleTimeChip = (time) => {
    const next = sliderIndexToDate(
      SLIDER_MARKS.indexOf(time),
      form.targetTime instanceof Date ? form.targetTime : new Date(),
      SLIDER_MARKS,
    );
    onFormChange({ ...form, targetTime: next });
  };

  const handleStationClick = (station, role) => {
    const activeRole = role ?? pickRole;
    const label = formatStationLabel(station.name);
    if (activeRole === "departure") {
      onFormChange({
        ...form,
        departure: label,
        departureStationId: station.id,
        ...(sameStation(form.destinationStationId, station.id)
          ? { destination: "", destinationStationId: null }
          : {}),
      });
      setPickRole("destination");
      return;
    }
    if (sameStation(station.id, form.departureStationId)) return;
    onFormChange({
      ...form,
      destination: label,
      destinationStationId: station.id,
    });
  };

  const handleConfirmRouteFromMap = (depName, depId, destName, destId) => {
    onFormChange({
      ...form,
      departure: depName,
      departureStationId: depId,
      destination: destName,
      destinationStationId: destId,
    });
    setPickRole("destination");
  };

  const canSearch = form.departureStationId && form.destinationStationId;
  const nearestStationId = useMemo(() => {
    if (!geoLocation) return null;
    const nearest = getNearestStationsByGeo(geoLocation.lat, geoLocation.lng, 1)[0];
    return nearest?.id ?? null;
  }, [geoLocation]);

  const headerSub =
    mapViewMode === "geo"
      ? "카카오 지도 위 역별 혼잡 · 마커에서 출발·도착 지정"
      : "역을 클릭해 출발·도착을 지정하세요 · 혼잡 역은 부드러운 할로로 표시";

  const timeChips = (
    <div className="flex rounded-xl bg-slate-100 p-1 shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)]">
      {SLIDER_MARKS.map((time) => (
        <button
          key={time}
          type="button"
          onClick={() => handleTimeChip(time)}
          className={`flex-1 rounded-lg px-1.5 py-1.5 text-xs font-medium transition-all ${
            selectedTime === time
              ? "bg-white text-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
              : "text-slate-500"
          }`}
        >
          {time}
        </button>
      ))}
    </div>
  );

  return (
    <div className="animate-fade-in space-y-3 pb-28">
      <header>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">서울 지하철 노선도</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="내 위치로 이동"
            onClick={() => {
              if (!geoLocation) onRequestLocation?.();
              if (nearestStationId) setFocusStationId(nearestStationId);
            }}
          >
            <LocateFixed className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{headerSub}</p>
        {locationState === "loading" && (
          <p className="mt-0.5 text-[11px] text-slate-500">내 위치 확인 중...</p>
        )}
        {locationState === "denied" && (
          <p className="mt-0.5 text-[11px] text-rose-600">
            위치 권한을 허용하면 내 위치로 이동할 수 있어요.
          </p>
        )}
        {mapViewMode === "schematic" && (
          <p className="mt-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-800">
            1~8호선 서울 지하철 역만 표시됩니다. 경기·인천 등 수도권 외 역은 경로
            텍스트에서만 확인할 수 있습니다.
          </p>
        )}
      </header>

      <MapViewModeToggle value={mapViewMode} onChange={setMapViewMode} />

      {timeChips}

      {mapViewMode === "schematic" && (
        <>
          <div className="flex gap-2">
            {["departure", "destination"].map((role) => {
              const active = pickRole === role;
              const isDep = role === "departure";
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setPickRole(role)}
                  className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                    active
                      ? isDep
                        ? "bg-green-50 text-green-800 shadow-[inset_0_0_0_2px_#16a34a]"
                        : "bg-rose-50 text-rose-800 shadow-[inset_0_0_0_2px_#e11d48]"
                      : "bg-slate-50 text-slate-600 shadow-[inset_0_1px_3px_rgba(15,23,42,0.04)]"
                  }`}
                >
                  {isDep ? (
                    <MapPin className="h-4 w-4 shrink-0" />
                  ) : (
                    <Navigation className="h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium opacity-70">
                      {isDep ? "출발" : "도착"}
                    </p>
                    <p className="truncate font-semibold">
                      {isDep
                        ? form.departure || "역을 선택하세요"
                        : form.destination || "역을 선택하세요"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <InteractiveMetroMap
            selectedTime={selectedTime}
            departureStationId={form.departureStationId}
            destinationStationId={form.destinationStationId}
            pickRole={pickRole}
            onStationClick={handleStationClick}
            seoulOnly
            focusStationId={focusStationId}
            busyHighlightMode="halo"
            showLineCongestion={false}
          />
        </>
      )}

      {mapViewMode === "geo" && (
        <>
          {(form.departure || form.destination) && (
            <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
              출발 <strong className="text-slate-800">{form.departure || "—"}</strong>
              <span className="mx-1.5 text-slate-300">→</span>
              도착 <strong className="text-slate-800">{form.destination || "—"}</strong>
            </p>
          )}
          <MapScreen
            embedded
            targetTime={form.targetTime}
            onConfirmRoute={handleConfirmRouteFromMap}
          />
        </>
      )}

      <Button size="lg" className="w-full" disabled={!canSearch} onClick={onSearch}>
        경로 예측 검색
      </Button>

      <p className="text-center text-[10px] text-slate-400">
        {mapViewMode === "geo" ? (
          <>
            카카오맵 · 뷰포트 혼잡 로딩 · {formatTime(form.targetTime ?? new Date())}{" "}
            기준
          </>
        ) : (
          <>{formatTime(form.targetTime ?? new Date())} 기준</>
        )}
      </p>
    </div>
  );
}
