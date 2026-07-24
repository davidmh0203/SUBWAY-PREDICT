"""ODsay API 저수준 클라이언트 (서버 전용 키)."""

from __future__ import annotations

import re
from typing import Any

import httpx

from app.config import ODSAY_API_BASE, ODSAY_API_KEY, ODSAY_FORCE_MOCK, ODSAY_SEOUL_CID
from app.odsay_cache import cache_get, cache_set


class OdsayError(Exception):
    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.code = code


class UnsupportedLineRouteError(OdsayError):
    """ODsay 경로는 있으나 1~8호선만으로는 이동 불가 (9호선·신분당 등)."""

    def __init__(self, message: str = "1~8호선만으로 이동 가능한 경로가 없습니다."):
        super().__init__(message, code="unsupported_lines")


def is_configured() -> bool:
    """키가 있고 강제 목업이 아닐 때만 실호출."""
    if ODSAY_FORCE_MOCK:
        return False
    return bool(ODSAY_API_KEY)


def normalize_station_name(raw: str) -> str:
    trimmed = raw.strip()
    if not trimmed:
        return ""
    return re.sub(r"역$", "", trimmed)


async def call_odsay(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    if not ODSAY_API_KEY:
        raise OdsayError("ODSAY_API_KEY가 설정되지 않았습니다.")

    query = {"apiKey": ODSAY_API_KEY, "lang": 0, **(params or {})}
    url = f"{ODSAY_API_BASE}/{path.lstrip('/')}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=query)
        data = response.json()

    if data.get("error"):
        errors = data["error"]
        if isinstance(errors, list) and errors:
            first = errors[0]
            raise OdsayError(
                first.get("message", "ODsay API 오류"),
                str(first.get("code", "")),
            )
        raise OdsayError(str(errors))

    return data


async def search_station(
    raw_query: str,
    *,
    cid: int | None = ODSAY_SEOUL_CID,
    display_cnt: int = 20,
    normalize: bool = True,
) -> dict[str, Any]:
    name = normalize_station_name(raw_query) if normalize else raw_query.strip()
    if len(name) < 2:
        raise OdsayError("역 이름은 2자 이상이어야 합니다.")

    params: dict[str, Any] = {
        "stationName": name,
        "stationClass": 2,
        "displayCnt": display_cnt,
    }
    if cid is not None:
        params["CID"] = cid

    cache_key = f"{name}|{cid}|{display_cnt}|{int(normalize)}"
    cached = cache_get("station", cache_key)
    if cached is not None:
        return cached

    data = await call_odsay("searchStation", params)
    cache_set("station", cache_key, data)
    return data


async def search_pub_trans_path(
    sx: float,
    sy: float,
    ex: float,
    ey: float,
    *,
    search_path_type: int = 1,
) -> dict[str, Any]:
    """지하철 위주 경로 (SearchPathType=1)."""
    cache_key = (
        f"{round(sx, 5)}|{round(sy, 5)}|{round(ex, 5)}|{round(ey, 5)}|{search_path_type}"
    )
    cached = cache_get("path", cache_key)
    if cached is not None:
        return cached

    data = await call_odsay(
        "searchPubTransPathT",
        {
            "SX": sx,
            "SY": sy,
            "EX": ex,
            "EY": ey,
            "OPT": 0,
            "SearchType": 0,
            "SearchPathType": search_path_type,
        },
    )
    cache_set("path", cache_key, data)
    return data
