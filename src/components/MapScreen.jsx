import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { METRO_STATIONS, stationToPseudoGeo } from "@/lib/metro-network";
import { fetchBatchCongestion } from "@/lib/api/client";
import { rateToCrowdLevel } from "@/lib/congestion";
import { getStationCongestionSnapshot } from "@/lib/crowd-data";
import realCoords from "@/lib/generated/real-station-coords.json";

// 엑셀에서 변환된 실제 위경도를 가져오고, 데이터가 없는 41개 역은 가상 좌표로 폴백
const getCoords = (station) => {
  const real = realCoords[station.name];
  if (real && real.lat && real.lng) {
    return { lat: real.lat, lng: real.lng };
  }
  return stationToPseudoGeo(station);
};


/* ────────────────────────────────────────────────────────────
 * 뷰포트 지연 로딩 튜닝 값
 * 587개를 한 번에 부르지 않고, 화면에 들어온 역만 그때그때 부른다.
 * 지도 레벨로 막지 않는다. 원(Circle)은 클러스터러와 무관하게
 * 모든 레벨에서 보이므로, 보이는 것은 전부 갱신 대상이어야 한다.
 * 대신 중심에서 가까운 순으로 30개씩 순차 요청해 버스트를 막는다.
 * ──────────────────────────────────────────────────────────── */
const CHUNK_SIZE = 30; // 한 요청에 묶을 역 개수
const INITIAL_LEVEL = 4; // 진입 시 지도 확대 정도 (작을수록 확대)

/* ────────────────────────────────────────────────────────────
 * 혼잡도 색상: 단일 소스
 * 핀 / 원 / 배지 / 프로그레스 바가 모두 이 값을 참조한다.
 * 레벨 판정은 항상 rateToCrowdLevel(rate) 하나로만 한다.
 * ──────────────────────────────────────────────────────────── */
const LEVEL_COLOR = {
  RELAXED: "#22c55e", // 여유 - 초록
  NORMAL: "#eab308", // 보통 - 노랑
  BUSY: "#ef4444", // 혼잡 - 빨강
  VERY_BUSY: "#b91c1c", // 매우 혼잡 - 진한 빨강
  EXTREME: "#7f1d1d",
  DEFAULT: "#94a3b8", // 데이터 없음 - 회색
};

const colorOf = (level) => LEVEL_COLOR[level] ?? LEVEL_COLOR.DEFAULT;

// 레벨별 구간. rateToCrowdLevel의 임계값과 반드시 일치해야 한다.
const LEVEL_BAND = {
  RELAXED: [0, 30],
  NORMAL: [30, 60],
  BUSY: [60, 80],
  VERY_BUSY: [80, 100],
  EXTREME: [100, 150],
  DEFAULT: [0, 100],
};

// 해당 레벨 구간 안에서 rate가 얼마나 높은지 (0 ~ 1)
const bandRatio = (level, rate) => {
  const [min, max] = LEVEL_BAND[level] ?? LEVEL_BAND.DEFAULT;
  const clamped = Math.max(min, Math.min(max, rate));
  return (clamped - min) / (max - min || 1);
};

// 구간 안에서 rate가 높을수록 원이 진해진다.
const circleStyleOf = (level, rate) => {
  const color = colorOf(level);
  const ratio = bandRatio(level, rate);
  return {
    strokeColor: color,
    strokeOpacity: 0.25 + ratio * 0.8,
    fillColor: color,
    fillOpacity: 0.15 + ratio * 0.6,
  };
};

/* ────────────────────────────────────────────────────────────
 * 핀 이미지: SVG 데이터 URI로 직접 생성
 * 외부 CDN(maps.google.com/mapfiles) 의존을 제거해
 * 로딩 실패로 핀이 사라지는 문제와 노랑/주황 구분 문제를 없앤다.
 * ──────────────────────────────────────────────────────────── */
const pinSvg = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
     <path d="M16 1C8.3 1 2 7.3 2 15c0 10.5 14 26 14 26s14-15.5 14-26C30 7.3 23.7 1 16 1z"
           fill="${color}" stroke="#ffffff" stroke-width="2"/>
     <circle cx="16" cy="15" r="5" fill="#ffffff" fill-opacity="0.95"/>
   </svg>`;

// 587개 역이 같은 이미지를 공유하므로 레벨당 1개만 만들어 캐싱한다.
const pinCache = new Map();
const getPinImage = (level) => {
  if (pinCache.has(level)) return pinCache.get(level);
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSvg(colorOf(level)))}`;
  const image = new window.kakao.maps.MarkerImage(
    src,
    new window.kakao.maps.Size(32, 42),
    { offset: new window.kakao.maps.Point(16, 42) }, // 핀 끝이 좌표에 닿도록
  );
  pinCache.set(level, image);
  return image;
};

// 하단 정보 카드용 스타일. 색상은 위 LEVEL_COLOR와 같은 계열로 맞춘다.
const getCongestionStyle = (level) => {
  switch (level) {
    case "RELAXED":
      return {
        label: "여유",
        color: "bg-[#eefcf5] text-[#15803d] border-[#d1f5e3]",
        barColor: "bg-[#22c55e]",
      };
    case "NORMAL":
      return {
        label: "보통",
        color: "bg-[#fef9eb] text-[#a16207] border-[#fdf0cd]",
        barColor: "bg-[#eab308]",
      };
    case "BUSY":
      return {
        label: "혼잡",
        color: "bg-[#fff5f5] text-[#b91c1c] border-[#ffd5d5]",
        barColor: "bg-[#ef4444]",
      };
    case "VERY_BUSY":
    case "EXTREME":
      return {
        label: "매우 혼잡",
        color: "bg-[#fef2f2] text-[#7f1d1d] border-[#fecaca]",
        barColor: "bg-[#b91c1c]",
      };
    default:
      return {
        label: "보통",
        color: "bg-[#fef9eb] text-[#a16207] border-[#fdf0cd]",
        barColor: "bg-[#eab308]",
      };
  }
};

export function MapScreen({ onBack, onConfirmRoute }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const clustererRef = useRef(null);
  const markersMapRef = useRef(new Map());
  const circlesMapRef = useRef(new Map());
  const ratesRef = useRef(new Map()); // 역 이름 → 최신 rate (클릭 시 즉시 표시용)
  const entriesRef = useRef([]); // [{ name, lat, lng, latLng }] — 뷰포트 판정용
  const loadedRef = useRef(new Set()); // 이미 부른(또는 요청 중인) 역
  const queueRef = useRef([]); // 부를 차례를 기다리는 역
  const runningRef = useRef(false); // 큐 소진 루프가 도는 중인지

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [congestion, setCongestion] = useState(null);
  const [congestionLoading, setCongestionLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tempDeparture, setTempDeparture] = useState(null);

  // 지도의 마커와 원을 갱신. level은 받지 않고 rate에서 직접 계산한다.
  const updateStationOnMap = (stationName, rate) => {
    if (!window.kakao || !window.kakao.maps) return;

    const level = rate == null ? "DEFAULT" : rateToCrowdLevel(rate); // 배지와 100% 동일한 레벨
    if (rate != null) ratesRef.current.set(stationName, rate);

    const marker = markersMapRef.current.get(stationName);
    if (marker) marker.setImage(getPinImage(level));

    const circle = circlesMapRef.current.get(stationName);
    if (circle) circle.setOptions(circleStyleOf(level, rate ?? 0));
  };

  useEffect(() => {
    const rawApiKey = import.meta.env.VITE_KAKAO_MAP_API_KEY;
    const apiKey = rawApiKey ? rawApiKey.trim() : "";
    if (!apiKey) {
      console.warn("[KakaoMap] API Key is missing!");
      setError(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let activeCircles = [];
    let idleHandler = null;

    /* 큐에 쌓인 역을 CHUNK_SIZE개씩 순차로 요청한다.
     * 루프는 항상 하나만 돈다. 사용자가 이동하면 큐에 더 쌓일 뿐이다. */
    const drainQueue = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      setSyncing(true);

      try {
        while (queueRef.current.length > 0) {
          if (cancelled) return;
          const batch = queueRef.current.splice(0, CHUNK_SIZE);

          try {
            // 요청 시점의 현재 시각을 쓴다 (사용자가 오래 머물 수 있으므로)
            const res = await fetchBatchCongestion(batch, new Date());
            if (cancelled) return;

            for (const name of batch) {
              const info = res.byName[name];
              if (info) updateStationOnMap(name, info.rate);
              // 응답에 없는 역: 백엔드가 그 역을 못 다루는 것이므로 재시도하지 않는다.
              // 스냅샷 색을 그대로 유지한다.
            }
          } catch (err) {
            // 네트워크/서버 오류: 표시를 풀어 다음 이동 때 자동으로 다시 시도된다.
            console.warn("[KakaoMap] 혼잡도 요청 실패, 다음 이동 시 재시도:", err);
            if (cancelled) return;
            for (const name of batch) loadedRef.current.delete(name);
          }
        }
      } finally {
        // cancelled면 이미 cleanup이 정리했고 다음 이펙트가 루프를 소유한다.
        // 여기서 건드리면 루프가 두 개 도는 경합이 생긴다.
        if (!cancelled) {
          runningRef.current = false;
          setSyncing(false);
        }
      }
    };

    /* 화면 안에 있으면서 아직 안 부른 역을 중심에서 가까운 순으로 큐에 넣는다.
     * 지도 레벨로 막지 않는다. 축소해도 30개씩 순차로 나갈 뿐이다. */
    const syncViewport = () => {
      const map = mapRef.current;
      if (!map || cancelled) return;

      const bounds = map.getBounds();
      const center = map.getCenter();
      const cLat = center.getLat();
      const cLng = center.getLng();

      const pending = [];
      for (const entry of entriesRef.current) {
        if (loadedRef.current.has(entry.name)) continue;
        if (!bounds.contain(entry.latLng)) continue;
        pending.push(entry);
      }
      if (pending.length === 0) return;

      // 화면 한가운데부터 색이 차오르도록
      pending.sort((a, b) => {
        const da = (a.lat - cLat) ** 2 + (a.lng - cLng) ** 2;
        const db = (b.lat - cLat) ** 2 + (b.lng - cLng) ** 2;
        return da - db;
      });

      for (const entry of pending) {
        loadedRef.current.add(entry.name); // 중복 요청 방지를 위해 즉시 표시
        queueRef.current.push(entry.name);
      }
      drainQueue();
    };

    function initMap() {
      window.kakao.maps.load(() => {
        if (cancelled || !mapContainerRef.current) return;

        // 로컬 스냅샷으로 전체 핀에 즉시 색을 입힌다.
        // 화면에 들어온 역만 이후 백엔드 값으로 교체된다.
        const snapshot = getStationCongestionSnapshot(new Date());
        const snapshotRates = {};
        for (const item of snapshot) {
          // stationLevel은 쓰지 않는다. 레벨은 rate로부터만 계산한다.
          snapshotRates[item.stationName] = item.stationRate;
        }

        // 시작 위치를 서울 '시청'역으로 지정
        const cityHall = METRO_STATIONS.find((s) => s.name === "시청");
        const initialLoc = cityHall
          ? getCoords(cityHall)
          : { lat: 37.5665, lng: 126.978 };

        const createdMap = new window.kakao.maps.Map(mapContainerRef.current, {
          center: new window.kakao.maps.LatLng(initialLoc.lat, initialLoc.lng),
          level: INITIAL_LEVEL,
        });
        mapRef.current = createdMap;

        const clusterer = new window.kakao.maps.MarkerClusterer({
          map: createdMap,
          averageCenter: true,
          minLevel: 6,
        });
        clustererRef.current = clusterer;

        const entries = [];

        const markers = METRO_STATIONS.filter((station) => {
          const real = realCoords[station.name];
          return real && real.lat && real.lng;
        }).map((station) => {
          const pos = realCoords[station.name];
          const markerPosition = new window.kakao.maps.LatLng(pos.lat, pos.lng);

          const rate = snapshotRates[station.name] ?? null;
          const level = rate === null ? "DEFAULT" : rateToCrowdLevel(rate);
          if (rate !== null) ratesRef.current.set(station.name, rate);

          const marker = new window.kakao.maps.Marker({
            position: markerPosition,
            image: getPinImage(level),
          });

          const circle = new window.kakao.maps.Circle({
            center: markerPosition,
            radius: 100,
            strokeWeight: 1,
            strokeStyle: "solid",
            ...circleStyleOf(level, rate ?? 0),
          });

          // 지도 확대/축소와 무관하게 항상 보이도록 지도에 직접 등록
          circle.setMap(createdMap);
          activeCircles.push(circle);

          markersMapRef.current.set(station.name, marker);
          circlesMapRef.current.set(station.name, circle);
          entries.push({
            name: station.name,
            lat: pos.lat,
            lng: pos.lng,
            latLng: markerPosition,
          });

          window.kakao.maps.event.addListener(marker, "click", () => {
            setSelectedStation(station);
          });

          return marker;
        });

        clusterer.addMarkers(markers);
        entriesRef.current = entries;
        setLoading(false);

        // 사용자가 지도를 옮기거나 확대/축소를 멈출 때마다 그 영역을 채운다.
        idleHandler = () => syncViewport();
        window.kakao.maps.event.addListener(createdMap, "idle", idleHandler);

        // 첫 화면은 idle을 기다리지 않고 바로 채운다.
        syncViewport();
      });
    }

    const existingScript = document.getElementById("kakao-map-sdk");
    if (existingScript) {
      if (window.kakao && window.kakao.maps) {
        initMap();
      } else {
        existingScript.addEventListener("load", initMap);
      }
    } else {
      const script = document.createElement("script");
      script.id = "kakao-map-sdk";
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=clusterer&autoload=false`;
      script.async = true;
      script.onload = initMap;
      script.onerror = (e) => {
        console.error("[KakaoMap] Script loading failed.", e);
        setError(true);
        setLoading(false);
      };
      document.head.appendChild(script);
    }

    return () => {
      // cancelled 플래그로 진행 중인 큐 소진을 즉시 중단시킨다.
      cancelled = true;

      if (idleHandler && mapRef.current) {
        window.kakao.maps.event.removeListener(mapRef.current, "idle", idleHandler);
      }
      activeCircles.forEach((circle) => circle.setMap(null));
      activeCircles = [];
      clustererRef.current?.clear();
      markersMapRef.current.clear();
      circlesMapRef.current.clear();
      ratesRef.current.clear();
      entriesRef.current = [];
      loadedRef.current.clear();
      queueRef.current = [];
      runningRef.current = false;
    };
  }, []);

  // 역 선택 시: 캐시된 값을 즉시 보여주고, 백그라운드에서 최신값으로 갱신
  useEffect(() => {
    if (!selectedStation) {
      setCongestion(null);
      setCongestionLoading(false);
      return;
    }

    let stale = false;
    const stationName = selectedStation.name;
    const cached = ratesRef.current.get(stationName);

    if (cached != null) {
      setCongestion({ rate: cached, source: "CACHE" });
      setCongestionLoading(false); // 이미 값이 있으므로 스피너를 띄우지 않는다
    } else {
      setCongestionLoading(true);
    }

    fetchBatchCongestion([stationName], new Date())
      .then((res) => {
        if (stale) return;
        const info = res.byName[stationName];
        const rate = info ? info.rate : (cached ?? 50);
        setCongestion({ rate, source: info ? "PREDICTION" : "FALLBACK" });
        updateStationOnMap(stationName, rate);
        loadedRef.current.add(stationName);
      })
      .catch((err) => {
        if (stale) return;
        console.error("[KakaoMap] Failed to fetch station congestion:", err);
        if (cached == null) {
          setCongestion({ rate: 45, source: "FALLBACK" });
          updateStationOnMap(stationName, 45);
        }
      })
      .finally(() => {
        if (!stale) setCongestionLoading(false);
      });

    return () => {
      stale = true; // 빠르게 다른 역을 클릭했을 때 이전 응답이 덮어쓰지 않도록
    };
  }, [selectedStation]);

  // 하단 서랍이 열리고 닫히며 지도 높이가 바뀔 때 relayout
  useEffect(() => {
    if (!mapRef.current) return;

    const timer = setTimeout(() => {
      if (!mapRef.current) return;
      mapRef.current.relayout();

      // 역을 고를 때만 그 역으로 이동한다.
      // 선택을 취소할 때는 사용자가 보던 위치를 그대로 둔다.
      if (selectedStation) {
        const pos = getCoords(selectedStation);
        mapRef.current.panTo(new window.kakao.maps.LatLng(pos.lat, pos.lng));
      }
    }, 310);

    return () => clearTimeout(timer);
  }, [selectedStation]);

  return (
    <div className="flex flex-col h-screen pb-20 bg-slate-50 overflow-hidden">
      {/* 헤더 */}
      <header className="flex h-14 items-center justify-between px-4 bg-white border-b border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex-shrink-0">
        <button
          onClick={onBack}
          type="button"
          className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-slate-800">지하철역 혼잡도 지도</h1>
        <div className="w-10"></div>
      </header>

      {/* 내부 콘텐츠 */}
      <div className="flex-1 p-4 max-w-lg mx-auto w-full flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col bg-white rounded-2xl p-4 shadow-surface border border-slate-100 gap-3 overflow-hidden">
          <div className="flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-slate-50 text-slate-800 rounded-lg border border-slate-100">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">수도권 지하철역 지도</h2>
                <p className="text-[11px] text-slate-400">
                  지도를 움직이면 그 지역의 혼잡도를 불러옵니다.
                </p>
              </div>
            </div>
          </div>

          {/* 범례 */}
          <div className="flex items-center gap-3 flex-shrink-0 px-0.5">
            {[
              { c: LEVEL_COLOR.RELAXED, t: "여유" },
              { c: LEVEL_COLOR.NORMAL, t: "보통" },
              { c: LEVEL_COLOR.BUSY, t: "혼잡" },
              { c: LEVEL_COLOR.VERY_BUSY, t: "매우 혼잡" },
            ].map((item) => (
              <div key={item.t} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.c }}
                ></span>
                <span className="text-[11px] text-slate-500">{item.t}</span>
              </div>
            ))}
          </div>

          {/* 지도 컨테이너 (선택 시 하단 서랍 공간 132px 확보용으로 수축) */}
          <div
            style={{ height: selectedStation ? "calc(100% - 132px)" : "100%" }}
            className="relative rounded-xl overflow-hidden border border-slate-100 bg-slate-100 shadow-inner transition-[height] duration-300 ease-in-out flex-grow"
          >
            {/* 임시 선택된 출발역 표시 배너 */}
            {tempDeparture && (
              <div className="absolute top-3 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-600 text-white shadow-md border border-emerald-500 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                출발역: {tempDeparture.name}
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/90 backdrop-blur-sm gap-3">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                <span className="text-sm font-medium text-slate-500">지하철 노선 로딩 중...</span>
              </div>
            )}

            {/* 현재 영역 혼잡도를 불러오는 동안만 표시 */}
            {!loading && !error && syncing && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-sm backdrop-blur-sm">
                <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                <span className="text-[11px] font-medium text-slate-600">
                  이 지역 혼잡도 불러오는 중
                </span>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-red-50/95 p-6 text-center gap-2">
                <p className="text-sm font-bold text-red-600">지도 로딩 실패</p>
                <p className="text-xs text-red-400 leading-relaxed">
                  프로젝트의 <code className="px-1 bg-white border rounded">.env</code> 파일에 유효한{" "}
                  <code className="px-1 bg-white border rounded">VITE_KAKAO_MAP_API_KEY</code>를
                  등록하고, 개발자 센터에 도메인 화이트리스트가 등록되어 있는지 확인해주세요.
                </p>
              </div>
            )}

            <div id="map" ref={mapContainerRef} className="w-full h-full rounded-xl"></div>
          </div>

          {/* 지하철역 실시간 혼잡도 정보 */}
          {selectedStation && (
            <div className="h-[120px] flex flex-col gap-2 pt-2 border-t border-slate-100 animate-slide-up flex-shrink-0 justify-center">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-800 text-white rounded-lg">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    {selectedStation.name}역 혼잡도
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTempDeparture({
                        name: selectedStation.name + "역",
                        id: selectedStation.id,
                      });
                    }}
                    className="text-[11px] px-2.5 py-1 font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 active:scale-95 transition-all"
                  >
                    출발
                  </button>
                  <button
                    type="button"
                    disabled={!tempDeparture}
                    onClick={() => {
                      if (!tempDeparture) return;
                      onConfirmRoute?.(
                        tempDeparture.name,
                        tempDeparture.id,
                        selectedStation.name + "역",
                        selectedStation.id,
                      );
                    }}
                    style={{
                      backgroundColor: tempDeparture ? "#4f46e5" : "#f1f5f9",
                      color: tempDeparture ? "#ffffff" : "#94a3b8",
                      cursor: tempDeparture ? "pointer" : "not-allowed",
                    }}
                    className="text-[11px] px-2.5 py-1 font-semibold rounded-lg transition-all"
                  >
                    도착
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStation(null)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>

              {congestionLoading ? (
                <div className="flex-1 flex items-center justify-center gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100/50">
                  <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                  <span className="text-xs text-slate-500 font-medium">
                    FastAPI 예측 데이터 조회 중...
                  </span>
                </div>
              ) : congestion ? (
                (() => {
                  // 핀 / 원 / 배지가 모두 같은 함수로 레벨을 구한다.
                  const level = rateToCrowdLevel(congestion.rate);
                  const style = getCongestionStyle(level);
                  return (
                    <div className="flex-1 flex flex-col justify-center gap-2.5 bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">실시간 예측 혼잡률</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${style.color}`}
                          >
                            {style.label}
                          </span>
                          <span className="text-sm font-bold text-slate-800">
                            {congestion.rate}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${style.barColor}`}
                          style={{ width: `${Math.min(congestion.rate, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl p-3">
                  <span className="text-xs text-slate-400">혼잡도 데이터를 표시할 수 없습니다.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}