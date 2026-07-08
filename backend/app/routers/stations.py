"""역 목록 / 검색 엔드포인트 (/stations)."""

from fastapi import APIRouter
from app.schemas import StationsResponse
from app.mock_data import STATIONS

router = APIRouter()


@router.get("/stations", response_model=StationsResponse, tags=["역"])
def get_stations(query: str | None = None):
    """역 목록을 반환. query가 있으면 이름에 포함된 역만 필터링.

    프론트의 출발·도착역 자동완성에 사용합니다.
    """
    if query:
        result = [s for s in STATIONS if query in s["name"]]
    else:
        result = STATIONS
    return {"stations": result}