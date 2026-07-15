"""서울교통공사 지하철알림정보 (B553766/ntce)."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import httpx

from app.config import (
    NTCE_API_BASE,
    TRAIN_ALERT_API_DECOIND_KEY,
    TRAIN_ALERT_API_KEY,
)
from app.ttl_cache import cache_get, cache_set

KST = ZoneInfo("Asia/Seoul")
NTCE_CACHE_TTL = 900  # 15분

SELECT_FIELDS = ",".join(
    [
        "noftSeCd",
        "noftTtl",
        "noftCn",
        "nonstopYn",
        "upbdnbSe",
        "xcseSitnBgngDt",
        "xcseSitnEndDt",
        "lineNm",
        "lineNmLst",
        "stnCd",
        "noftOcrnDt",
    ]
)


def is_configured() -> bool:
    return bool(TRAIN_ALERT_API_DECOIND_KEY or TRAIN_ALERT_API_KEY)


def _ymd(d: date) -> str:
    return d.strftime("%Y%m%d")


def _extract_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    body = payload.get("response", {}).get("body") or payload.get("body") or payload
    items = (
        (body.get("items") or {}).get("item")
        if isinstance(body.get("items"), dict)
        else body.get("items")
    )
    if items is None:
        items = body.get("item") or []
    if not isinstance(items, list):
        items = [items] if items else []
    return [i for i in items if isinstance(i, dict)]


def _is_auth_failure(header: dict[str, Any] | None, status: int, text: str) -> bool:
    if status in (401, 403):
        return True
    msg = str((header or {}).get("resultMsg") or "")
    code = str((header or {}).get("resultCode") or "")
    blob = f"{msg} {code} {text[:200]}"
    return bool(
        re.search(
            r"SERVICE_KEY|UNAUTHORIZED|FORBIDDEN|NOT_REGISTERED|INVALID_REQUEST",
            blob,
            re.I,
        )
    )


def _build_url(params: dict[str, str], service_key: str, mode: str) -> str:
    if mode == "decoding":
        q = dict(params)
        q["serviceKey"] = service_key
        return f"{NTCE_API_BASE}?{urlencode(q)}"
    # Encoding 키: 이미 %xx — 재인코딩 금지
    return f"{NTCE_API_BASE}?{urlencode(params)}&serviceKey={service_key}"


async def _fetch_page(
    client: httpx.AsyncClient,
    *,
    start_ymd: str,
    end_ymd: str,
    page: int,
    service_key: str,
    mode: str,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None, int, str]:
    params = {
        "dataType": "JSON",
        "pageNo": str(page),
        "numOfRows": "100",
        "srchStartNoftOcrnYmd": start_ymd,
        "srchEndNoftOcrnYmd": end_ymd,
        "selectFields": SELECT_FIELDS,
    }
    url = _build_url(params, service_key, mode)
    res = await client.get(url, timeout=20.0)
    text = res.text
    try:
        payload = res.json()
    except Exception:
        return [], None, res.status_code, text
    header = payload.get("response", {}).get("header") or payload.get("header")
    return _extract_items(payload), header if isinstance(header, dict) else None, res.status_code, text


async def fetch_ntce_for_day(target: date | None = None) -> list[dict[str, Any]]:
    """당일 알림 목록. 키 없거나 실패 시 빈 리스트."""
    if target is None:
        target = datetime.now(KST).date()
    cache_key = f"ntce:{target.isoformat()}"
    cached = cache_get(cache_key, NTCE_CACHE_TTL)
    if cached is not None:
        return cached

    if not is_configured():
        return []

    ymd = _ymd(target)
    attempts: list[tuple[str, str]] = []
    if TRAIN_ALERT_API_DECOIND_KEY:
        attempts.append(("decoding", TRAIN_ALERT_API_DECOIND_KEY))
    if TRAIN_ALERT_API_KEY:
        attempts.append(("encoding", TRAIN_ALERT_API_KEY))

    items: list[dict[str, Any]] = []
    async with httpx.AsyncClient() as client:
        for mode, key in attempts:
            page_items, header, status, text = await _fetch_page(
                client,
                start_ymd=ymd,
                end_ymd=ymd,
                page=1,
                service_key=key,
                mode=mode,
            )
            if _is_auth_failure(header, status, text):
                continue
            items = page_items
            # 추가 페이지 (최대 3)
            for page in range(2, 4):
                more, hdr, st, tx = await _fetch_page(
                    client,
                    start_ymd=ymd,
                    end_ymd=ymd,
                    page=page,
                    service_key=key,
                    mode=mode,
                )
                if _is_auth_failure(hdr, st, tx) or not more:
                    break
                items.extend(more)
            break

    cache_set(cache_key, items)
    return items
