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
  // 현재페이지의 location: 주소 url 에서 #과 뒤에 있는 문자를 가져온다 -> url의 해시: 프레그먼트를
  // #와 그 뒤에 붙는 문자열을 가져온다 ex: #section1
  //가져온문자열에서 #를 "" 순수 빈 문자열로 바꾸고  순수한값만 추출-> section1만
  // 그렇게 가져온 순수 값을 hash 라는 변수에 담음
  return VIEWS.includes(hash) ? hash : null;
  // 가져온 해시가 VIEW에 담긴 라우터와 일치하면 그대로, 아니면 null 리턴
}

export default function App() {
  const [view, setView] = useState(() => readHashView() ?? "home");
  // 해시 받아왔을때 그게 참이면 그 값으로 , 유효하지않은 null/false이면 ?? 뒤에 있는 문자열로 사용
  const [form, setForm] = useState({
    departure: "시청역",
    destination: "동대문역",
    departureStationId: "시청|1호선",
    destinationStationId: "동대문|1호선",
    targetTime: createDefaultTime(),
  });
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [locationState, setLocationState] = useState("idle");
  const [geoLocation, setGeoLocation] = useState(null);

  const nearbyCongestion = useMemo(
    () => getNearbyStationCongestion(form.targetTime, geoLocation, 4),
    [form.targetTime, geoLocation],
  );
  // 페이지를 어디로 보내주는 함수
  //useCallback : 컴포넌트 리렌더링될때 함수 새로 생성하지않고 재사용(메모이제이션)하게 해주는 훅
  // 불피요한 함수 재생성 막기- > 자식컴포넌트 렌더링 최적화
  // 컴포넌트 렌더링될때마다 내부함수들도 모두 새로 만들어짐 ->
  // 자식컴포넌트의 props로 전달되면 자식컴포넌트가 함수 바뀐줄 알고 불필요하게 리렌더링
  // useCallback 하면 의존성 배열의 값 변경되지 않는한 기존에 만든 함수객체를 그대로 유지
  // useCallback 함수 저장? 자식에게 함수 전달되어도 리렌더링시 함수 객체가 사라지지 않게
  const navigateTo = useCallback(
    (next) => {
      // next라는 데이터 전달.  next는 움직일 페이지 정보 -> 해시 라우팅이니까 움직이고 싶은 페이지의 해시값을 넣어주면됨
      if (next === "detail") {
        // 입력받은 다음 페이지 데이터가  디테일이면
        setSelectedRoute((prev) => {
          // 선택된 경로정보 수정 하는 함수
          if (prev) return prev; // 전달받은 데이터 있으면 prev: 전달받은그 데이터 반환
          const routes = buildRoutes(
            // 그게 아니면 경로 정보들을 form 에 담긴 걸로 가져오기, '역' 텍스트는 ""로 대체해주고.
            form.targetTime,
            form.departure.replace(/역.*$/, ""),
            form.destination.replace(/역.*$/, ""),
          );
          return routes[0] ?? null; // 그리고 경로정보 리스트의 0번째 를 리턴해
          // 경로정보 배열이 참이면: 배열이 채워져있으면 0번째 데이터 반환
          // 그게 아니면 null 리턴
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
      <div
        className={`min-h-screen bg-white ${view === "macro" ? "px-2 pt-4" : "px-4 pt-6"}`}
      >
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
            form={form} // form 정보 prop으로 받기
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
                  active
                    ? "text-slate-800 font-medium"
                    : "text-slate-400 hover:text-slate-600",
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
