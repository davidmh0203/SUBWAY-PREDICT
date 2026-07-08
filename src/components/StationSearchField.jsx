import { useId, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { LineBadge } from "@/components/LineBadge";
import { searchLocalStations } from "@/lib/local-station-search";
import { normalizeStationSearchQuery } from "@/lib/odsay-station";
import { colorForLineKey } from "@/lib/station-line-colors";

export function StationSearchField({
  label,
  icon: Icon,
  value,
  stationId,
  onChange,
  excludeStationId,
  placeholder = "역 이름 입력",
}) {
  const listId = useId();
  const containerRef = useRef(null);
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    if (!focused) return [];
    return searchLocalStations(value, { limit: 8, excludeId: excludeStationId });
  }, [focused, value, excludeStationId]);

  const showSuggestions = focused && normalizeStationSearchQuery(value).length >= 2;
  const selectedLineKey = useMemo(() => {
    if (!stationId) return null;
    const [, lineKey] = String(stationId).split("|");
    return lineKey || null;
  }, [stationId]);

  const handleSelect = (station) => {
    onChange({ text: `${station.name}역`, stationId: station.id });
    setFocused(false);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setFocused(false);
      }
    }, 120);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block">
        <span className="mb-1.5 flex items-center gap-2 text-xs text-slate-500">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </span>
        <input
          value={value}
          onChange={(e) => onChange({ text: e.target.value, stationId: null })}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)] outline-none transition focus:bg-white focus:shadow-[inset_0_1px_3px_rgba(15,23,42,0.08),0_0_0_2px_rgba(148,163,184,0.25)]"
        />
      </label>

      {stationId && !focused && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
          <Check className="h-3 w-3" />
          역 선택됨
          {selectedLineKey && (
            <>
              <span className="text-slate-300">|</span>
              <LineBadge
                lineKey={selectedLineKey}
                color={colorForLineKey(selectedLineKey)}
                size="sm"
              />
              <span className="text-slate-600">{selectedLineKey}</span>
            </>
          )}
        </p>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((station) => (
            <li key={station.id} role="option">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(station)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
              >
                <span className="text-sm font-medium text-slate-800">{station.name}역</span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {station.lineKeys.map((lineKey, i) => (
                    <LineBadge
                      key={`${station.id}-${lineKey}`}
                      lineKey={lineKey}
                      color={station.lineColors[i] ?? "#64748b"}
                      size="sm"
                    />
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showSuggestions && suggestions.length === 0 && (
        <p className="absolute left-0 right-0 z-20 mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
          검색 결과 없음
        </p>
      )}
    </div>
  );
}
