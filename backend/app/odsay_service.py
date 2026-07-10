"""ODsay 응답 → 앱 스키마 변환 + mock 혼잡도 결합."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.mock_data import STATIONS, _base_congestion, build_mock_route
from app.odsay_client import (
    OdsayError,
    is_configured,
    normalize_station_name,
    search_pub_trans_path,
    search_station,
)
from app.odsay_cache import cache_get, cache_set
from app.schemas import congestion_level
from app.station_registry import line_label as _line_label
from app.station_registry import resolve as _resolve_station


def _score_match(station_name: str, normalized_query: str) -> int:
    # 역명 끝 "역"을 양쪽 모두 제거한 뒤 비교 (ODsay는 "서울역"처럼 역이 붙은 경우가 섞임)
    name = normalize_station_name(station_name)
    if name == normalized_query:
        return 100
    if name.startswith(normalized_query):
        return 80
    if normalized_query in name:
        return 60
    return 0


def _pick_best_station(stations: list[dict[str, Any]], query: str) -> dict[str, Any] | None:
    if not stations:
        return None
    normalized = normalize_station_name(query)
    # 점수 동률이면 노선 번호(type)가 낮은 지하철 우선 → 서울역이면 1호선 선택
    return max(
        stations,
        key=lambda s: (
            _score_match(s.get("stationName", ""), normalized),
            -int(s.get("type", 999) or 999),
        ),
    )


def _odsay_station_to_api(station: dict[str, Any]) -> dict[str, str | list[str]]:
    line = _line_label(station.get("laneName"))
    cid = station.get("CID", "")
    sid = station.get("stationID", "")
    return {
        "station_id": f"{cid}-{sid}",
        "name": station.get("stationName", ""),
        "lines": [line] if line else [],
    }


async def search_stations_for_api(query: str | None) -> list[dict[str, Any]]:
    if not query:
        return STATIONS

    if not is_configured():
        q = normalize_station_name(query)
        return [s for s in STATIONS if q in s["name"]]

    try:
        data = await search_station(query)
        raw = data.get("result", {}).get("station", []) or []
        seen: set[str] = set()
        result: list[dict[str, Any]] = []
        for item in raw:
            mapped = _odsay_station_to_api(item)
            key = f"{mapped['name']}|{','.join(mapped['lines'])}"
            if key in seen:
                continue
            seen.add(key)
            result.append(mapped)
        if result:
            return result
    except OdsayError:
        pass

    q = normalize_station_name(query)
    return [s for s in STATIONS if q in s["name"]]


async def resolve_station_coords(name: str) -> tuple[dict[str, Any], float, float]:
    data = await search_station(name)
    stations = data.get("result", {}).get("station", []) or []
    picked = _pick_best_station(stations, name)
    if not picked:
        raise OdsayError(f"역을 찾을 수 없습니다: {name}")
    x = float(picked["x"])
    y = float(picked["y"])
    return picked, x, y


def _extract_subway_paths(path_item: dict[str, Any]) -> list[dict[str, Any]]:
    return [sp for sp in path_item.get("subPath", []) if sp.get("trafficType") == 1]


def _stations_from_subpaths(subpaths: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered: list[dict[str, Any]] = []
    for sp in subpaths:
        stops = (sp.get("passStopList") or {}).get("stations") or []
        line = _line_label((sp.get("lane") or [{}])[0].get("name"))
        for stop in stops:
            entry = {
                "station_id": str(stop.get("stationID", "")),
                "name": stop.get("stationName", ""),
                "line": line,
            }
            if ordered and ordered[-1]["name"] == entry["name"]:
                if entry["line"] not in ordered[-1].get("_lines", [ordered[-1]["line"]]):
                    ordered[-1]["_lines"] = list(
                        dict.fromkeys([ordered[-1]["line"], entry["line"]])
                    )
                continue
            ordered.append(entry)
    return ordered


def _build_segments_from_subpaths(
    subpaths: list[dict[str, Any]],
    hour: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    base = _base_congestion(hour)
    segments: list[dict[str, Any]] = []
    route_stations: list[dict[str, Any]] = []

    for idx_sp, sp in enumerate(subpaths):
        stops = (sp.get("passStopList") or {}).get("stations") or []
        if len(stops) < 2:
            continue
        line = _line_label((sp.get("lane") or [{}])[0].get("name"))
        for i in range(len(stops) - 1):
            a, b = stops[i], stops[i + 1]
            c = min(base + len(segments) * 5, 100)
            segments.append(
                {
                    "line": line,
                    "from_station": a.get("stationName", ""),
                    "to_station": b.get("stationName", ""),
                    "train_congestion": c,
                    "level": congestion_level(c),
                }
            )

        for i, stop in enumerate(stops):
            fallback_transfer = idx_sp > 0 and i == 0
            row = _resolve_station(line, stop.get("stationName", ""))
            is_transfer = row["is_transfer"] if row else fallback_transfer
            if route_stations and route_stations[-1]["name"] == stop.get("stationName"):
                route_stations[-1]["is_transfer"] = (
                    route_stations[-1]["is_transfer"] or is_transfer
                )
                continue
            # TODO(step2): congestion lookup — resolve()+daytype()+time_bucket()+resolve_direction()
            c = min(base + len(route_stations) * 4, 100)
            route_stations.append(
                {
                    "station_id": str(stop.get("stationID", "")),
                    "name": stop.get("stationName", ""),
                    "line": line,
                    "station_congestion": c,
                    "level": congestion_level(c),
                    "is_transfer": is_transfer,
                }
            )

    if route_stations:
        route_stations[0]["is_transfer"] = False
        route_stations[-1]["is_transfer"] = route_stations[-1].get("is_transfer", False)

    return segments, route_stations


def _route_from_odsay_path(
    start: str,
    end: str,
    departure_time: datetime,
    path_item: dict[str, Any],
) -> dict[str, Any]:
    info = path_item.get("info") or {}
    subpaths = _extract_subway_paths(path_item)
    segments, stations = _build_segments_from_subpaths(subpaths, departure_time.hour)

    if not stations:
        raise OdsayError("ODsay 경로에 지하철 구간이 없습니다.")

    overall = min(_base_congestion(departure_time.hour) + 6, 100)
    transfer_count = max(0, int(info.get("subwayTransitCount", 0) or 0))

    return {
        "summary": {
            "total_time_min": int(info.get("totalTime", 0) or 0),
            "transfer_count": transfer_count,
            "payment": int(info.get("payment", 0) or 0) or None,
            "overall_congestion": overall,
            "overall_level": congestion_level(overall),
        },
        "segments": segments,
        "stations": stations,
    }


async def predict_route_with_odsay(
    start: str,
    end: str,
    departure_time: datetime,
) -> dict[str, Any]:
    if not is_configured():
        return build_mock_route(start, end, departure_time.hour)

    start_key = normalize_station_name(start)
    end_key = normalize_station_name(end)
    cache_key = f"{start_key}|{end_key}|{departure_time.hour}"
    cached = cache_get("route", cache_key)
    if cached is not None:
        return cached

    try:
        _, sx, sy = await resolve_station_coords(start)
        _, ex, ey = await resolve_station_coords(end)
        data = await search_pub_trans_path(sx, sy, ex, ey, search_path_type=1)
        paths = data.get("result", {}).get("path") or []
        if not paths:
            raise OdsayError("경로 결과가 없습니다.")
        route_body = _route_from_odsay_path(start, end, departure_time, paths[0])
        cache_set("route", cache_key, route_body)
        return route_body
    except OdsayError:
        return build_mock_route(start, end, departure_time.hour)