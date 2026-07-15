import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, Map, Route, Star } from "lucide-react";
import { HomeScreen } from "@/components/HomeScreen";
import { RouteResultsScreen } from "@/components/RouteResultsScreen";
import { RouteDetailScreen } from "@/components/RouteDetailScreen";
import { MacroViewScreen } from "@/components/MacroViewScreen";
import { FavoritesScreen } from "@/components/FavoritesScreen";
import { AuthScreen } from "@/components/AuthScreen";
import { buildRoutes } from "@/lib/mock-data";
import { getNearbyStationCongestion } from "@/lib/crowd-data";
import { cn } from "@/lib/utils";
import { getToken, logout as apiLogout, me } from "@/lib/api/auth";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/api/favorites";
import { fetchRoutesFromApi } from "@/lib/api/client";
import { formatHHMM } from "@/lib/route-timing";

const VIEWS = ["home", "results", "detail", "favorites", "macro", "login"];

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

  // 로그인 사용자 + 즐겨찾기 상태. 별표 채움 여부는 이 목록과 (start, end, route_key)
  // 대조로만 판단한다 — 클라이언트가 자체적으로 즐겨찾기 여부를 추정하지 않는다.
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authReturnView, setAuthReturnView] = useState("home");
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [routeNotice, setRouteNotice] = useState(null);

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

  // 부팅 시 토큰이 있으면 /auth/me로 로그인 상태 복원 (만료/무효면 me()가 토큰을 지움)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setAuthChecked(true);
        return;
      }
      try {
        const restored = await me();
        if (!cancelled) setUser(restored);
      } catch {
        // 토큰 만료/무효 — me()가 이미 localStorage를 정리함
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    try {
      const list = await listFavorites();
      setFavorites(list);
    } catch {
      // 실패 시 기존 목록 유지
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  // 로그인 시 1회 로드, 로그아웃 시 비움
  useEffect(() => {
    if (user) {
      refreshFavorites();
    } else {
      setFavorites([]);
    }
  }, [user, refreshFavorites]);

  const goToLogin = useCallback(() => {
    setAuthReturnView(view);
    navigateTo("login");
  }, [view, navigateTo]);

  const handleAuthSuccess = useCallback(
    (nextUser) => {
      setUser(nextUser);
      navigateTo(authReturnView || "home");
    },
    [authReturnView, navigateTo],
  );

  const handleAuthEntry = useCallback(() => {
    if (user) {
      apiLogout();
      setUser(null);
    } else {
      goToLogin();
    }
  }, [user, goToLogin]);

  // 즐겨찾기 추가/삭제는 서버가 정답 — 응답으로 받은 값으로만 목록을 갱신한다.
  // departure_time(시:분)도 식별자에 포함 — 같은 경로를 출근/퇴근처럼 다른
  // 시각으로 여러 개 즐겨찾기할 수 있게 하기 위함. 시각은 호출부(RouteResultsScreen)가
  // 넘겨주는 실제 검색 시각을 그대로 쓴다 — form.targetTime은 결과 화면의 혼잡도
  // 슬라이더가 되돌아 써버릴 수 있어 신뢰할 수 없다.
  const handleToggleFavorite = useCallback(
    async (route, { startName, endName, departureTime: departureDate }) => {
      if (!user) {
        goToLogin();
        return;
      }
      const departureTime = formatHHMM(departureDate);
      const existing = favorites.find(
        (f) =>
          f.start_name === startName &&
          f.end_name === endName &&
          f.route_key === route.routeKey &&
          f.departure_time === departureTime,
      );
      try {
        if (existing) {
          await removeFavorite(existing.id);
          setFavorites((prev) => prev.filter((f) => f.id !== existing.id));
        } else {
          if (favorites.length >= 5) return;
          const created = await addFavorite({
            startName,
            endName,
            routeKey: route.routeKey,
            routeLabel: route.routeLabel,
            departureTime,
          });
          setFavorites((prev) => [created, ...prev]);
        }
      } catch {
        // 실패 시 다음 목록 갱신에서 정합성 회복
      }
    },
    [user, favorites, goToLogin],
  );

  const handleRemoveFavorite = useCallback(async (id) => {
    await removeFavorite(id);
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // 즐겨찾기는 결과가 아니라 (start, end, route_key, departure_time)만 저장하므로,
  // 열 때마다 /predict/route를 다시 불러 현재 혼잡도로 채운다. 시각은 저장된
  // "HH:MM"을 오늘 날짜에 적용해 재구성한다 (특정 날짜가 아니라 매일 반복되는
  // 출퇴근 시각을 즐겨찾기하는 개념). route_key가 일치하는 경로가 없으면
  // (운행 변경 등) 첫 번째 경로로 fallback하고 안내한다.
  const handleOpenFavorite = useCallback(
    async (favorite) => {
      const [hh, mm] = favorite.departure_time.split(":").map(Number);
      const target = new Date();
      target.setHours(hh, mm, 0, 0);
      try {
        const routes = await fetchRoutesFromApi(favorite.start_name, favorite.end_name, target);
        const matched = routes.find((r) => r.routeKey === favorite.route_key);
        const chosen = matched ?? routes[0];
        if (!chosen) {
          setRouteNotice("경로 정보를 찾을 수 없습니다.");
          return;
        }
        setForm((prev) => ({
          ...prev,
          departure: `${favorite.start_name}역`,
          destination: `${favorite.end_name}역`,
          departureStationId: null,
          destinationStationId: null,
          targetTime: target,
        }));
        setSelectedRoute(chosen);
        setRouteNotice(
          matched ? null : "저장된 경로를 찾을 수 없어 첫 번째 경로로 안내합니다.",
        );
        navigateTo("detail");
      } catch {
        setRouteNotice("경로를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    },
    [navigateTo],
  );

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
      { id: "favorites", label: "즐겨찾기", icon: Star },
      { id: "macro", label: "노선도", icon: Map },
    ],
    [],
  );

  const navigate = (id) => {
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
            user={authChecked ? user : null}
            onAuthEntry={handleAuthEntry}
          />
        )}
        {view === "results" && (
          <RouteResultsScreen
            form={form} // form 정보 prop으로 받기
            onBack={() => navigateTo("home")}
            onSelectRoute={handleSelectRoute}
            onTimeChange={handleTimeChange}
            user={user}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        {view === "detail" && selectedRoute && (
          <>
            {routeNotice && (
              <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {routeNotice}
              </div>
            )}
            <RouteDetailScreen
              route={selectedRoute}
              departureTime={form.targetTime}
              onBack={() => {
                setRouteNotice(null);
                navigateTo("results");
              }}
            />
          </>
        )}
        {view === "favorites" && (
          <FavoritesScreen
            user={user}
            favorites={favorites}
            favoritesLoading={favoritesLoading}
            onRemoveFavorite={handleRemoveFavorite}
            onOpenFavorite={handleOpenFavorite}
            onGoLogin={goToLogin}
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
        {view === "login" && (
          <AuthScreen
            onBack={() => navigateTo(authReturnView || "home")}
            onAuthSuccess={handleAuthSuccess}
          />
        )}
      </div>

      {view !== "login" && (
        <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 bg-white/90 backdrop-blur-md shadow-[0_-1px_12px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-around px-2 py-2">
            {bottomNav.map(({ id, label, icon: Icon }) => {
              const active = view === id || (view === "detail" && id === "results");
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(id)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs transition-all",
                    active
                      ? "text-slate-800 font-medium"
                      : "text-slate-400 hover:text-slate-600",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "scale-105")} />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
