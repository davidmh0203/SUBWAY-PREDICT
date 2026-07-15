"""혼잡도 예측 엔드포인트 (/predict/route, /congestion/station, /congestion/hourly)."""

from datetime import datetime
from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query

from app.congestion_model import get_predictor, predict_station
from app.mock_data import STATIONS, _base_congestion
from app.odsay_service import predict_route_with_odsay
from app.route_key import build_route_key, build_route_label
from app.schemas import (
    BatchCongestionRequest,
    BatchCongestionResponse,
    HourlyCongestionResponse,
    RouteRequest,
    RouteResponse,
    StationCongestion,
    congestion_level,
)
from app.station_types import station_type_for

router = APIRouter()


@router.post("/predict/route", response_model=RouteResponse, tags=["예측"])
async def predict_route(req: RouteRequest):
    """출발역·도착역·출발시각으로 경로 혼잡도 예측.

    ODsay로 경로를 구하고, 혼잡도는 models/ CongestionPredictor로 채웁니다.
    모델·ODsay 미가용 시 mock으로 fallback.
    """
    result = await predict_route_with_odsay(req.start, req.end, req.departure_time)
    # 배열 인덱스로 경로를 식별하면 ODsay 응답 순서가 바뀔 때 즐겨찾기가 깨지므로
    # (호선, 환승역) 시퀀스 기반 route_key를 각 경로에 실어 보낸다.
    alternatives = [
        {
            **alt,
            "route_key": build_route_key(alt.get("segments") or []),
            "route_label": build_route_label(alt.get("segments") or []),
        }
        for alt in result.get("alternatives") or []
    ]
    return {
        "start": req.start,
        "end": req.end,
        "departure_time": req.departure_time,
        **result,
        "route_key": build_route_key(result.get("segments") or []),
        "route_label": build_route_label(result.get("segments") or []),
        "alternatives": alternatives,
    }


@router.get(
    "/congestion/station/{station_id}",
    response_model=StationCongestion,
    tags=["예측"],
)
def get_station_congestion(
    station_id: str,
    time: datetime = Query(..., description="예: 2026-07-08T18:30:00"),
    name: str | None = Query(None, description="역명 (모델 예측용, 없으면 STATIONS 조회)"),
):
    """특정 역 하나의 혼잡도만 조회."""
    station = next((s for s in STATIONS if s["station_id"] == station_id), None)
    station_name = name or (station["name"] if station else None)
    if station is None and not station_name:
        raise HTTPException(status_code=404, detail=f"역을 찾을 수 없습니다: {station_id}")

    display_name = station_name or station["name"]
    pred = predict_station(display_name, time, station_type_for(display_name))
    if pred:
        pct = float(pred["congestion_pct"])
        return {
            "station_id": station["station_id"] if station else station_id,
            "name": display_name,
            "time": time,
            "station_congestion": int(round(pct)),
            "level": pred["congestion_level"],
            "congestion_pct": pct,
            "congestion_label": pred.get("label"),
            "congestion_color": pred.get("congestion_color"),
            "prob_increase": pred.get("prob_increase"),
            "prob_normal": pred.get("prob_normal"),
            "prob_decrease": pred.get("prob_decrease"),
            "source": "model",
        }

    congestion = _base_congestion(time.hour)
    return {
        "station_id": station["station_id"] if station else station_id,
        "name": display_name,
        "time": time,
        "station_congestion": congestion,
        "level": congestion_level(congestion),
        "source": "mock",
    }


@lru_cache(maxsize=64)
def _hourly_cached(station: str, day: str) -> tuple[str, tuple]:
    points = []
    predictor = get_predictor()
    for hour in range(6, 24):
        dt = datetime.fromisoformat(f"{day}T{hour:02d}:30:00")
        if predictor is not None:
            pred = predict_station(station, dt, station_type_for(station))
            if pred:
                pct = float(pred["congestion_pct"])
                points.append(
                    (hour, int(round(pct)), pred["congestion_level"], pct, "model")
                )
                continue
        c = _base_congestion(hour)
        points.append((hour, c, congestion_level(c), float(c), "mock"))
    source = "model" if points and points[0][4] == "model" else "mock"
    return source, tuple(points)


@router.get(
    "/congestion/hourly",
    response_model=HourlyCongestionResponse,
    tags=["예측"],
)
def get_hourly_congestion(
    name: str = Query(..., description="역명 예: 합정"),
    date: str = Query(..., description="YYYY-MM-DD"),
):
    """출발역의 6~23시 혼잡도. ODsay 호출 없음 — 로컬 모델만."""
    source, raw = _hourly_cached(name.strip(), date)
    return {
        "name": name.strip(),
        "date": date,
        "source": source,
        "points": [
            {
                "hour": h,
                "rate": rate,
                "level": level,
                "congestion_pct": pct,
                "source": src,
            }
            for h, rate, level, pct, src in raw
        ],
    }


@router.post(
    "/congestion/batch",
    response_model=BatchCongestionResponse,
    tags=["예측"],
)
def batch_station_congestion(req: BatchCongestionRequest):
    """여러 역 혼잡도 일괄 예측. ODsay 없음 — 슬라이더 시각 변경용."""
    names = list(dict.fromkeys(n.strip() for n in req.names if n and n.strip()))
    stations = []
    any_model = False
    for name in names:
        pred = predict_station(name, req.departure_time, station_type_for(name))
        if pred:
            pct = float(pred["congestion_pct"])
            any_model = True
            stations.append(
                {
                    "name": name,
                    "station_congestion": int(round(pct)),
                    "level": pred["congestion_level"],
                    "congestion_pct": pct,
                    "source": "model",
                }
            )
        else:
            c = _base_congestion(req.departure_time.hour)
            stations.append(
                {
                    "name": name,
                    "station_congestion": c,
                    "level": congestion_level(c),
                    "congestion_pct": float(c),
                    "source": "mock",
                }
            )
    return {
        "departure_time": req.departure_time,
        "source": "model" if any_model else "mock",
        "stations": stations,
    }

