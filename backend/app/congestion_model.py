"""혼잡도 모델(CongestionPredictor) 로드 및 경로/단건 예측."""

from __future__ import annotations

import logging
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.schemas import congestion_level
from app.station_types import station_type_for

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"


def hour_to_time_slot(dt: datetime) -> str:
    h = dt.hour
    if h < 6:
        return "before_06"
    if h >= 24:
        return "after_24"
    return f"{h:02d}_{h + 1:02d}"


@lru_cache(maxsize=1)
def get_predictor():
    """모델 아티팩트 로드. 실패 시 None (호출측에서 mock fallback)."""
    try:
        import sys

        if str(MODELS_DIR) not in sys.path:
            sys.path.insert(0, str(MODELS_DIR))
        from predict import CongestionPredictor  # type: ignore

        if not (MODELS_DIR / "encoders.pkl").exists():
            logger.warning("혼잡 모델 아티팩트 없음: %s", MODELS_DIR)
            return None
        return CongestionPredictor(model_dir=str(MODELS_DIR), verbose=False)
    except Exception:
        logger.exception("혼잡 모델 로드 실패")
        return None


def predict_station(
    name: str,
    departure_time: datetime,
    station_type: str | None = None,
    weather: dict[str, Any] | None = None,
    event: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    predictor = get_predictor()
    if predictor is None:
        return None
    st_type = station_type or station_type_for(name)
    try:
        return predictor.predict(
            station_name=name,
            station_type=st_type,
            date=departure_time.strftime("%Y-%m-%d"),
            time_slot=hour_to_time_slot(departure_time),
            weather=weather,
            event=event,
        )
    except Exception:
        logger.exception("혼잡 예측 실패: %s", name)
        return None


def apply_model_to_route_stations(
    stations: list[dict[str, Any]],
    departure_time: datetime,
) -> list[dict[str, Any]]:
    """route_stations 목록에 모델 혼잡도를 채운다. 모델 없으면 원본 유지."""
    predictor = get_predictor()
    if predictor is None or not stations:
        return stations

    payload = [
        {"name": s.get("name", ""), "type": station_type_for(s.get("name", ""))}
        for s in stations
    ]
    try:
        results = predictor.predict_route(
            stations=payload,
            date=departure_time.strftime("%Y-%m-%d"),
            time_slot=hour_to_time_slot(departure_time),
        )
    except Exception:
        logger.exception("경로 혼잡 예측 실패")
        return stations

    by_name = {r["station_name"]: r for r in results}
    out: list[dict[str, Any]] = []
    for s in stations:
        r = by_name.get(s.get("name", ""))
        if not r:
            out.append(s)
            continue
        pct = float(r.get("congestion_pct") or 0)
        level = r.get("congestion_level") or congestion_level(int(round(pct)))
        merged = {
            **s,
            "station_congestion": int(round(pct)),
            "level": level,
            "congestion_pct": pct,
            "congestion_label": r.get("label"),
            "congestion_color": r.get("congestion_color"),
            "prob_increase": r.get("prob_increase"),
            "prob_normal": r.get("prob_normal"),
            "prob_decrease": r.get("prob_decrease"),
            "source": "model",
        }
        out.append(merged)
    return out


def apply_model_to_segments(
    segments: list[dict[str, Any]],
    stations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """열차 구간 혼잡도는 from역 모델값을 사용."""
    by_name = {s.get("name"): s for s in stations}
    out = []
    for seg in segments:
        src = by_name.get(seg.get("from_station"))
        if not src:
            out.append(seg)
            continue
        c = int(src.get("station_congestion", seg.get("train_congestion", 0)))
        out.append(
            {
                **seg,
                "train_congestion": c,
                "level": src.get("level") or congestion_level(c),
            }
        )
    return out


def overall_from_stations(stations: list[dict[str, Any]]) -> tuple[int, str]:
    if not stations:
        return 0, congestion_level(0)
    vals = [int(s.get("station_congestion", 0)) for s in stations]
    overall = max(vals)
    # level: 모델이 채운 최고 혼잡 역의 level 우선
    top = max(stations, key=lambda s: int(s.get("station_congestion", 0)))
    level = top.get("level") or congestion_level(overall)
    return overall, level
