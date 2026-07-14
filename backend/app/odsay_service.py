"""ODsay 응답 → 앱 스키마 변환 + mock 혼잡도 결합."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.congestion_model import (
    apply_model_to_route_stations,
    apply_model_to_segments,
    get_predictor,
    overall_from_stations,
)
from app.fixture_routes import find_fixture_payload
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

    model_source = "mock"
    if get_predictor() is not None:
        stations = apply_model_to_route_stations(stations, departure_time)
        segments = apply_model_to_segments(segments, stations)
        if any(s.get("source") == "model" for s in stations):
            model_source = "model"

    overall, overall_level = overall_from_stations(stations)
    if model_source == "mock":
        overall = min(_base_congestion(departure_time.hour) + 6, 100)
        overall_level = congestion_level(overall)

    transfer_count = max(0, int(info.get("subwayTransitCount", 0) or 0))

    return {
        "summary": {
            "total_time_min": int(info.get("totalTime", 0) or 0),
            "transfer_count": transfer_count,
            "payment": int(info.get("payment", 0) or 0) or None,
            "overall_congestion": overall,
            "overall_level": overall_level,
            "model_source": model_source,
        },
        "segments": segments,
        "stations": stations,
    }


def _enrich_with_model(body: dict[str, Any], departure_time: datetime) -> dict[str, Any]:
    """mock/ODsay 경로 body에 모델 혼잡도를 덮어쓴다."""
    if get_predictor() is None:
        summary = dict(body.get("summary") or {})
        summary.setdefault("model_source", "mock")
        return {**body, "summary": summary}

    stations = apply_model_to_route_stations(list(body.get("stations") or []), departure_time)
    segments = apply_model_to_segments(list(body.get("segments") or []), stations)
    overall, overall_level = overall_from_stations(stations)
    source = "model" if any(s.get("source") == "model" for s in stations) else "mock"
    summary = {
        **(body.get("summary") or {}),
        "overall_congestion": overall,
        "overall_level": overall_level,
        "model_source": source,
    }
    alts = []
    for alt in body.get("alternatives") or []:
        alts.append(_enrich_with_model(alt, departure_time))
    return {
        **body,
        "summary": summary,
        "stations": stations,
        "segments": segments,
        "alternatives": alts,
    }


# ODsay path[] 중 UI 카드로 노출할 최대 개수
MAX_ROUTE_PATHS = 5


def _station_names_key(stations: list[dict[str, Any]]) -> str:
    return "|".join(s.get("name", "") for s in stations)


async def predict_route_with_odsay(
    start: str,
    end: str,
    departure_time: datetime,
) -> dict[str, Any]:
    if not is_configured():
        return _mock_or_fixture_route(start, end, departure_time)

    start_key = normalize_station_name(start)
    end_key = normalize_station_name(end)
    cache_key = f"v3|{start_key}|{end_key}|{departure_time.date().isoformat()}|{departure_time.hour}"
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

        parsed: list[dict[str, Any]] = []
        seen: set[str] = set()
        for path_item in paths[:MAX_ROUTE_PATHS]:
            try:
                body = _route_from_odsay_path(start, end, departure_time, path_item)
            except OdsayError:
                continue
            key = _station_names_key(body.get("stations") or [])
            if not key or key in seen:
                continue
            seen.add(key)
            parsed.append(body)

        if not parsed:
            raise OdsayError("유효한 지하철 경로가 없습니다.")

        primary = parsed[0]
        route_body = {
            **primary,
            "alternatives": parsed[1:],
        }
        cache_set("route", cache_key, route_body)
        return route_body
    except OdsayError:
        return _mock_or_fixture_route(start, end, departure_time)


def _mock_or_fixture_route(
    start: str,
    end: str,
    departure_time: datetime,
) -> dict[str, Any]:
    """ODsay 키 없음/실패 시: 데모 픽스처 우선, 없으면 단순 목업 + 혼잡 모델."""
    fixture = find_fixture_payload(start, end)
    if fixture:
        paths = (fixture.get("result") or {}).get("path") or []
        parsed: list[dict[str, Any]] = []
        seen: set[str] = set()
        for path_item in paths[:MAX_ROUTE_PATHS]:
            try:
                body = _route_from_odsay_path(start, end, departure_time, path_item)
            except OdsayError:
                continue
            key = _station_names_key(body.get("stations") or [])
            if not key or key in seen:
                continue
            seen.add(key)
            body = {**body, "source": "fixture"}
            if body.get("summary"):
                body["summary"] = {**body["summary"], "model_source": body["summary"].get("model_source")}
            parsed.append(body)
        if parsed:
            primary = parsed[0]
            return {
                **primary,
                "alternatives": parsed[1:],
                "source": "fixture",
            }

    body = build_mock_route(start, end, departure_time.hour)
    body.setdefault("alternatives", [])
    return _enrich_with_model(body, departure_time)