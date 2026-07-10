"""날짜별 공휴일·출퇴근 컨텍스트."""

from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

import httpx

from app.spcde_client import SpcdeError, get_rest_de_info, is_configured

KST = ZoneInfo("Asia/Seoul")


def _weekday_context(target: date) -> dict:
    return {
        "date": target.isoformat(),
        "isHoliday": False,
        "holidayName": None,
        "commuteProfile": "weekday",
    }


async def get_day_context(target: date | None = None) -> dict:
    """특정일의 공휴일 여부와 출퇴근 프로필을 반환합니다."""
    if target is None:
        target = datetime.now(KST).date()

    if not is_configured():
        return _weekday_context(target)

    try:
        items = await get_rest_de_info(target.year, target.month)
    except (SpcdeError, httpx.HTTPError):
        return _weekday_context(target)

    locdate = int(target.strftime("%Y%m%d"))
    holiday_names: list[str] = []

    for item in items:
        if item.get("isHoliday") != "Y":
            continue
        try:
            item_date = int(item.get("locdate", "0"))
        except ValueError:
            continue
        if item_date != locdate:
            continue
        name = item.get("dateName", "").strip()
        if name:
            holiday_names.append(name)

    if not holiday_names:
        return _weekday_context(target)

    return {
        "date": target.isoformat(),
        "isHoliday": True,
        "holidayName": holiday_names[0],
        "commuteProfile": "holiday",
    }
