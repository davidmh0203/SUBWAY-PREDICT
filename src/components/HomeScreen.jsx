import { Settings, MapPin, Train } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TimeBottomSheet, TimePickerButton } from "@/components/TimeBottomSheet";
import { TrafficForecastCarousel } from "@/components/TrafficForecastCarousel";
import { TODAY_EVENTS } from "@/lib/mock-data";

export function HomeScreen({ form, onFormChange, onSearch }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="animate-fade-in space-y-5 pb-24">
      <header className="flex items-center justify-between px-1">
        <Button variant="ghost" size="icon" aria-label="설정">
          <Settings className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Train className="h-5 w-5 text-slate-600" />
          <h1 className="text-lg font-bold tracking-tight text-slate-800">SUBWAY PREDICT</h1>
        </div>
        <div className="w-10" aria-hidden />
      </header>

      <TrafficForecastCarousel events={TODAY_EVENTS} />

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-600">어디로 이동하시나요?</h2>
        <Card>
          <CardContent className="space-y-3 p-4">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5" /> 출발
              </span>
              <input
                value={form.departure}
                onChange={(e) =>
                  onFormChange({ ...form, departure: e.target.value, departureStationId: null })
                }
                className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)] outline-none transition focus:bg-white focus:shadow-[inset_0_1px_3px_rgba(15,23,42,0.08),0_0_0_2px_rgba(148,163,184,0.25)]"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs text-slate-500">도착</span>
              <input
                value={form.destination}
                onChange={(e) =>
                  onFormChange({ ...form, destination: e.target.value, destinationStationId: null })
                }
                className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)] outline-none transition focus:bg-white focus:shadow-[inset_0_1px_3px_rgba(15,23,42,0.08),0_0_0_2px_rgba(148,163,184,0.25)]"
              />
            </label>
            <TimePickerButton value={form.targetTime} onClick={() => setSheetOpen(true)} />
            <Button size="lg" className="w-full" onClick={onSearch}>
              경로 예측 검색
            </Button>
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
