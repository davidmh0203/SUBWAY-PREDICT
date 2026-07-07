import { useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractiveMetroMap } from "@/components/InteractiveMetroMap";
import { SLIDER_MARKS } from "@/lib/mock-data";
import { formatTime } from "@/lib/congestion";

export function MacroViewScreen({ form, onFormChange, onSearch }) {
  const [selectedTime, setSelectedTime] = useState("18:30");
  const [pickRole, setPickRole] = useState("departure");

  const handleStationClick = (station, role) => {
    const label = `${station.name}역`;
    if (role === "departure") {
      onFormChange({
        ...form,
        departure: label,
        departureStationId: station.id,
        ...(form.destinationStationId === station.id
          ? { destination: "", destinationStationId: null }
          : {}),
      });
      setPickRole("destination");
      return;
    }
    if (station.id === form.departureStationId) return;
    onFormChange({
      ...form,
      destination: label,
      destinationStationId: station.id,
    });
  };

  const canSearch = form.departureStationId && form.destinationStationId;

  return (
    <div className="animate-fade-in space-y-3 pb-28">
      <header>
        <h1 className="text-lg font-bold text-slate-900">서울 지하철 노선도</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          역을 클릭해 출발·도착을 지정하세요 · 드래그 이동 · 스크롤 확대/축소
        </p>
        <p className="mt-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-800">
          1~9호선 서울 지하철 역만 표시됩니다. 경기·인천 등 수도권 외 역은 경로 텍스트에서만
          확인할 수 있습니다.
        </p>
      </header>

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
                <p className="text-[10px] font-medium opacity-70">{isDep ? "출발" : "도착"}</p>
                <p className="truncate font-semibold">
                  {isDep ? form.departure || "역을 선택하세요" : form.destination || "역을 선택하세요"}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex rounded-xl bg-slate-100 p-1 shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)]">
        {SLIDER_MARKS.map((time) => (
          <button
            key={time}
            type="button"
            onClick={() => setSelectedTime(time)}
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

      <InteractiveMetroMap
        selectedTime={selectedTime}
        departureStationId={form.departureStationId}
        destinationStationId={form.destinationStationId}
        pickRole={pickRole}
        onStationClick={handleStationClick}
        seoulOnly
      />

      <Button size="lg" className="w-full" disabled={!canSearch} onClick={onSearch}>
        경로 예측 검색
      </Button>

      <p className="text-center text-[10px] text-slate-400">
        혼잡도 시뮬레이션 {selectedTime} · {formatTime(new Date())} 갱신
      </p>
    </div>
  );
}
