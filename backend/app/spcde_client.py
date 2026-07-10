"""한국천문연구원 특일 정보 API 클라이언트 (공공데이터포털)."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from typing import Any

import httpx

from app.config import DATA_GO_API_KEY, SPCDE_API_BASE
from app.spcde_cache import cache_get, cache_set


class SpcdeError(Exception):
    pass


def is_configured() -> bool:
    return bool(DATA_GO_API_KEY)


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _parse_rest_de_xml(xml_text: str) -> list[dict[str, str]]:
    root = ET.fromstring(xml_text)
    items: list[dict[str, str]] = []

    for elem in root.iter():
        name = _local_name(elem.tag)
        if name == "resultCode" and elem.text and elem.text.strip() != "00":
            msg_elem = next(
                (child for child in root.iter() if _local_name(child.tag) == "resultMsg"),
                None,
            )
            msg = msg_elem.text.strip() if msg_elem is not None and msg_elem.text else "API 오류"
            raise SpcdeError(msg)
        if name == "item":
            item: dict[str, str] = {}
            for child in elem:
                item[_local_name(child.tag)] = (child.text or "").strip()
            if item:
                items.append(item)

    return items


async def get_rest_de_info(sol_year: int, sol_month: int) -> list[dict[str, str]]:
    """월별 공휴일 정보 조회 (getRestDeInfo)."""
    if not DATA_GO_API_KEY:
        raise SpcdeError("DATA_GO_API_KEY가 설정되지 않았습니다.")

    cache_key = f"{sol_year:04d}-{sol_month:02d}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    url = f"{SPCDE_API_BASE}/getRestDeInfo"
    params: dict[str, Any] = {
        "serviceKey": DATA_GO_API_KEY,
        "solYear": sol_year,
        "solMonth": sol_month,
        "numOfRows": 100,
        "pageNo": 1,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()

    items = _parse_rest_de_xml(response.text)
    cache_set(cache_key, items)
    return items
