"""공휴일·특일 정보 (/calendar/*)."""

from datetime import date

from fastapi import APIRouter, HTTPException, Query

from app.calendar_service import get_day_context
from app.spcde_client import is_configured

router = APIRouter(prefix="/calendar", tags=["캘린더"])


@router.get("/status")
async def calendar_status():
    return {
        "configured": is_configured(),
        "hint": "공공데이터포털 한국천문연구원 특일 정보 API 키(DATA_GO_API_KEY)가 필요합니다.",
    }


@router.get("/today")
async def calendar_today():
    return await get_day_context()


@router.get("/day")
async def calendar_day(
    date_str: str = Query(..., alias="date", pattern=r"^\d{4}-\d{2}-\d{2}$"),
):
    try:
        target = date.fromisoformat(date_str)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date는 YYYY-MM-DD 형식이어야 합니다.") from exc
    return await get_day_context(target)
