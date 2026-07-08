"""혼잡도 예측 엔드포인트 (/predict/route, /congestion/station)."""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from app.schemas import (
    RouteRequest,
    RouteResponse,
    StationCongestion,
    congestion_level,
)
from app.mock_data import STATIONS, _base_congestion
from app.odsay_service import predict_route_with_odsay

router = APIRouter()


@router.post("/predict/route", response_model=RouteResponse, tags=["예측"])
async def predict_route(req: RouteRequest):
    """출발역·도착역·출발시각으로 경로 혼잡도 예측.

    ODsay searchPubTransPathT로 경로를 구하고, 혼잡도는 mock 모델로 채웁니다.
    ODsay 미설정·인증 실패 시 mock 경로로 fallback.
    """
    result = await predict_route_with_odsay(req.start, req.end, req.departure_time)
    return {
        "start": req.start,
        "end": req.end,
        "departure_time": req.departure_time,
        **result,
    }


@router.get(
    "/congestion/station/{station_id}",
    response_model=StationCongestion,
    tags=["예측"],
)
def get_station_congestion(
    station_id: str,
    time: datetime = Query(..., description="예: 2026-07-08T18:30:00"),
):
    """특정 역 하나의 혼잡도만 조회. (모델 테스트 / 역 상세 화면용)"""
    station = next((s for s in STATIONS if s["station_id"] == station_id), None)
    if station is None:
        raise HTTPException(status_code=404, detail=f"역을 찾을 수 없습니다: {station_id}")

    congestion = _base_congestion(time.hour)
    return {
        "station_id": station["station_id"],
        "name": station["name"],
        "time": time,
        "station_congestion": congestion,
        "level": congestion_level(congestion),
    }