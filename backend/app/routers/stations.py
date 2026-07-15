"""역 목록 / 검색 / 주변 역 엔드포인트 (/stations)."""

from fastapi import APIRouter, HTTPException, Query

from app import kakao_client
from app.odsay_service import search_stations_for_api
from app.schemas import NearbyStationsResponse, StationsResponse

router = APIRouter()


@router.get("/stations", response_model=StationsResponse, tags=["역"])
async def get_stations(query: str | None = Query(None)):
    """역 목록·검색. ODsay searchStation 우선, 실패 시 mock fallback."""
    stations = await search_stations_for_api(query)
    return {"stations": stations}


@router.get(
    "/stations/nearby",
    response_model=NearbyStationsResponse,
    tags=["역"],
)
async def get_nearby_stations(
    lat: float = Query(..., description="위도"),
    lng: float = Query(..., description="경도"),
    radius: int = Query(1500, ge=100, le=20000, description="반경(m)"),
    limit: int = Query(4, ge=1, le=15, description="최대 개수"),
):
    """GPS 기준 주변 지하철역 (카카오 로컬 카테고리 SW8)."""
    if not kakao_client.is_configured():
        raise HTTPException(
            status_code=503,
            detail="KAKAO_REST_API_KEY 가 설정되지 않았습니다.",
        )
    try:
        stations = await kakao_client.search_nearby_subway(
            lat, lng, radius=radius, limit=limit
        )
    except Exception as exc:  # noqa: BLE001 — 카카오 오류를 502로
        raise HTTPException(
            status_code=502,
            detail=f"카카오 주변 역 조회 실패: {exc}",
        ) from exc
    return {"source": "kakao", "stations": stations}
