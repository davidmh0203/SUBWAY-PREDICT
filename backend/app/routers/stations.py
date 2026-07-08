"""역 목록 / 검색 엔드포인트 (/stations)."""

from fastapi import APIRouter, Query

from app.schemas import StationsResponse
from app.odsay_service import search_stations_for_api

router = APIRouter()


@router.get("/stations", response_model=StationsResponse, tags=["역"])
async def get_stations(query: str | None = Query(None)):
    """역 목록·검색. ODsay searchStation 우선, 실패 시 mock fallback."""
    stations = await search_stations_for_api(query)
    return {"stations": stations}