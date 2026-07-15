"""오늘의 정체 예보 (/forecast/*)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.csv_store import csv_stats
from app.forecast_service import build_forecast_cards
from app.ntce_client import is_configured as ntce_configured

router = APIRouter(prefix="/forecast", tags=["정체예보"])


@router.get("/status")
async def forecast_status():
    return {
        "ntceConfigured": ntce_configured(),
        "csv": csv_stats(),
        "hint": "집회 CSV는 data/spatic, 돌발 폴백은 data/metro-ntce. 당일 돌발은 TRAIN_ALERT_API_* 로 라이브 조회합니다.",
    }


@router.get("/cards")
async def forecast_cards(
    lat: float | None = Query(None, description="위도"),
    lng: float | None = Query(None, description="경도"),
    stations: str | None = Query(
        None,
        description="근처 역명 콤마 구분 (예: 강남,역삼). ODsay 호출 없음.",
    ),
    at: str | None = Query(
        None,
        description="기준 시각 ISO8601 (예: 2026-07-15T10:05:00.000Z). 미지정 시 현재.",
    ),
):
    station_list = [s.strip() for s in (stations or "").split(",") if s.strip()]
    return await build_forecast_cards(
        lat=lat, lng=lng, stations=station_list, at=at
    )
