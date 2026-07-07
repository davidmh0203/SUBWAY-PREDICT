import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, Map, Route, Train } from "lucide-react";
import { HomeScreen } from "@/components/HomeScreen";
import { RouteResultsScreen } from "@/components/RouteResultsScreen";
import { RouteDetailScreen } from "@/components/RouteDetailScreen";
import { MacroViewScreen } from "@/components/MacroViewScreen";
import { buildRoutes } from "@/lib/mock-data";
import { getNearbyStationCongestion } from "@/lib/crowd-data";
import { cn } from "@/lib/utils";

const VIEWS = ["home", "results", "detail", "macro"];

function createDefaultTime() {
  const d = new Date();
  d.setHours(18, 30, 0, 0);
  return d;
}

function readHashView() {
  const hash = window.location.hash.replace("#", "");
  return VIEWS.includes(hash) ? hash : null;
}

export default function App() {
  const [view, setView] = useState(() => readHashView() ?? "home");
  const [form, setForm] = useState({
    departure: "연신내역",
    destination: "봉은사역",
    departureStationId: "연신내",
    destinationStationId: "봉은사",
    targetTime: createDefaultTime(),
  });
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [locationState, setLocationState] = useState("idle");
  const [geoLocation, setGeoLocation] = useState(null);

  const nearbyCongestion = useMemo(
    () => getNearbyStationCongestion(form.targetTime, geoLocation, 4),
    [form.targetTime, geoLocation],
  );

  const navigateTo = useCallback(
    (next) => {
      if (next === "detail") {
        setSelectedRoute((prev) => {
          if (prev) return prev;
          const routes = buildRoutes(
            form.targetTime,
            form.departure.replace(/역.*$/, ""),
            form.destination.replace(/역.*$/, ""),
          );
          return routes[0] ?? null;
        });
      }
      if (readHashView() !== next) {
        window.location.hash = next;
      } else {
        setView(next);
      }
    },
    [form],
  );

  useEffect(() => {
    const applyHash = () => {
      const hash = readHashView();
      if (!hash) return;

      if (hash === "detail") {
        setSelectedRoute((prev) => {
          if (prev) return prev;
          const routes = buildRoutes(form.targetTime);
          return routes[0] ?? null;
        });
      }

      setView(hash);
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const handleSearch = useCallback(() => {
    navigateTo("results");
  }, [navigateTo]);

  const handleTimeChange = useCallback((targetTime) => {
    setForm((prev) => ({ ...prev, targetTime }));
  }, []);

  const handleSelectRoute = useCallback(
    (route) => {
      setSelectedRoute(route);
      navigateTo("detail");
    },
    [navigateTo],
  );

  const bottomNav = useMemo(
    () => [
      { id: "home", label: "홈", icon: Home },
      { id: "results", label: "경로", icon: Route },
      { id: "detail", label: "상세", icon: Train, disabled: !selectedRoute },
      { id: "macro", label: "노선도", icon: Map },
    ],
    [selectedRoute],
  );

  const navigate = (id) => {
    if (id === "detail" && !selectedRoute) return;
    navigateTo(id);
  };

  const requestLocation = useCallback(() => {
    if (!navigator?.geolocation) {
      setLocationState("denied");
      return;
    }
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationState("ready");
      },
      () => setLocationState("denied"),
      { enableHighAccuracy: false, timeout: 6000 },
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white">
      <div className={`min-h-screen bg-white ${view === "macro" ? "px-2 pt-4" : "px-4 pt-6"}`}>
        {view === "home" && (
          <HomeScreen
            form={form}
            onFormChange={setForm}
            onSearch={handleSearch}
            nearbyCongestion={nearbyCongestion}
            locationState={locationState}
            onRequestLocation={requestLocation}
          />
        )}
        {view === "results" && (
          <RouteResultsScreen
            form={form}
            onBack={() => navigateTo("home")}
            onSelectRoute={handleSelectRoute}
            onTimeChange={handleTimeChange}
          />
        )}
        {view === "detail" && selectedRoute && (
          <RouteDetailScreen
            route={selectedRoute}
            departureTime={form.targetTime}
            onBack={() => navigateTo("results")}
          />
        )}
        {view === "macro" && (
          <MacroViewScreen
            form={form}
            onFormChange={setForm}
            onSearch={handleSearch}
            geoLocation={geoLocation}
            locationState={locationState}
            onRequestLocation={requestLocation}
          />
        )}
      </div>

      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 bg-white/90 backdrop-blur-md shadow-[0_-1px_12px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-around px-2 py-2">
          {bottomNav.map(({ id, label, icon: Icon, disabled }) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => navigate(id)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs transition-all",
                  active ? "text-slate-800 font-medium" : "text-slate-400 hover:text-slate-600",
                  disabled && "opacity-30 pointer-events-none",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "scale-105")} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
