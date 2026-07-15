"""카카오 로컬 API — 주변 지하철역 (카테고리 SW8)."""

from __future__ import annotations

import re
from typing import Any

import httpx

from app.config import KAKAO_REST_API_KEY
from app.ttl_cache import cache_get, cache_set

KAKAO_CATEGORY_URL = "https://dapi.kakao.com/v2/local/search/category.json"
# 지하철역
CATEGORY_SUBWAY = "SW8"
CACHE_TTL = 300  # 5분
# "강남역 2호선", "홍대입구역" → 강남, 홍대입구
_LINE_SUFFIX = re.compile(
    r"\s*(?:\d+호선|공항철도|경의중앙|수인분당|신분당|우이신설|신림선|경춘선|경강선).*$"
)


def is_configured() -> bool:
    return bool(KAKAO_REST_API_KEY)


def normalize_station_place_name(place_name: str) -> str:
    name = (place_name or "").strip()
    name = _LINE_SUFFIX.sub("", name).strip()
    if name.endswith("역") and len(name) > 1:
        name = name[:-1]
    return name.strip()


async def search_nearby_subway(
    lat: float,
    lng: float,
    *,
    radius: int = 1500,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """중심 좌표 기준 가까운 지하철역. distance(m) 오름차순."""
    if not is_configured():
        return []

    radius = max(100, min(int(radius), 20000))
    limit = max(1, min(int(limit), 15))
    cache_key = f"kakao-sw8|{lat:.5f}|{lng:.5f}|{radius}|{limit}"
    cached = cache_get(cache_key, CACHE_TTL)
    if cached is not None:
        return list(cached)

    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {
        "category_group_code": CATEGORY_SUBWAY,
        "x": str(lng),
        "y": str(lat),
        "radius": str(radius),
        "sort": "distance",
        "size": str(min(limit * 3, 15)),  # 중복 제거 여유
    }

    async with httpx.AsyncClient(timeout=8.0) as client:
        res = await client.get(KAKAO_CATEGORY_URL, headers=headers, params=params)
        if res.status_code >= 400:
            detail = ""
            try:
                err = res.json()
                detail = str(err.get("message") or err.get("errorType") or res.text[:200])
            except Exception:  # noqa: BLE001
                detail = res.text[:200]
            raise RuntimeError(f"Kakao {res.status_code}: {detail}")
        payload = res.json()

    docs = payload.get("documents") or []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for doc in docs:
        if not isinstance(doc, dict):
            continue
        raw_name = str(doc.get("place_name") or "").strip()
        name = normalize_station_place_name(raw_name)
        if not name or name in seen:
            continue
        seen.add(name)
        try:
            distance = int(float(doc.get("distance") or 0))
        except (TypeError, ValueError):
            distance = 0
        try:
            x = float(doc.get("x"))
            y = float(doc.get("y"))
        except (TypeError, ValueError):
            x, y = lng, lat
        out.append(
            {
                "name": name,
                "placeName": raw_name,
                "distanceM": distance,
                "lat": y,
                "lng": x,
                "id": str(doc.get("id") or name),
            }
        )
        if len(out) >= limit:
            break

    cache_set(cache_key, out)
    return out
