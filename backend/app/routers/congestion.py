"""혼잡도 예측 엔드포인트 (/predict/route, /congestion/station)."""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from app.schemas import (
    RouteRequest,
    RouteResponse,
    StationCongestion,
    congestion_level,
)
from app.mock_data import STATIONS, build_mock_route, _base_congestion

router = APIRouter()


@router.post("/predict/route", response_model=RouteResponse, tags=["예측"])
def predict_route(req: RouteRequest):
    """★핵심★ 출발역·도착역·출발시각으로 경로 전체 혼잡도를 예측.

    지금은 가짜 데이터. 나중에 (1) 경로 탐색 (2) 모델 예측으로 속만 교체.
    """
    result = build_mock_route(req.start, req.end, req.departure_time.hour)
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