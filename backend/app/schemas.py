"""요청/응답 데이터 형식(스키마) 정의.

FastAPI는 여기 적힌 형식을 읽어서 /docs 문서를 자동으로 만들어줍니다.
프론트가 주고받을 JSON 모양이 곧 이 파일입니다.
"""

from datetime import datetime
from pydantic import BaseModel


# ---------- 공통 헬퍼 ----------
def congestion_level(value: int | float) -> str:
    """혼잡도 %(역 최대 대비) → 모델 단계 라벨.

    CongestionPredictor CONGESTION_LEVELS와 동일:
    여유 <30 / 보통 <60 / 혼잡 <80 / 매우혼잡 <100 / 극혼잡 ≥100
    """
    pct = float(value)
    if pct >= 100:
        return "극혼잡"
    if pct >= 80:
        return "매우혼잡"
    if pct >= 60:
        return "혼잡"
    if pct >= 30:
        return "보통"
    return "여유"


# ---------- /stations ----------
class Station(BaseModel):
    station_id: str
    name: str
    lines: list[str]


class StationsResponse(BaseModel):
    stations: list[Station]


# ---------- /predict/route ----------
class RouteRequest(BaseModel):
    start: str
    end: str
    departure_time: datetime


class Segment(BaseModel):
    line: str
    from_station: str
    to_station: str
    train_congestion: int      # 열차 혼잡도 (역 최대 대비 %)
    level: str


class RouteStation(BaseModel):
    station_id: str
    name: str
    line: str
    station_congestion: int    # 혼잡도 % (모델 congestion_pct 반올림)
    level: str
    is_transfer: bool
    congestion_pct: float | None = None
    congestion_label: str | None = None  # increase | normal | decrease
    congestion_color: str | None = None
    prob_increase: float | None = None
    prob_normal: float | None = None
    prob_decrease: float | None = None
    source: str | None = None  # model | mock


class RouteSummary(BaseModel):
    total_time_min: int
    transfer_count: int
    payment: int | None = None
    overall_congestion: int
    overall_level: str
    model_source: str | None = None


class RouteOption(BaseModel):
    """ODsay path[] 항목 하나 (primary와 동일 구조, 메타 제외)."""

    summary: RouteSummary
    segments: list[Segment]
    stations: list[RouteStation]


class RouteResponse(BaseModel):
    start: str
    end: str
    departure_time: datetime
    summary: RouteSummary
    segments: list[Segment]
    stations: list[RouteStation]
    alternatives: list[RouteOption] = []


# ---------- /congestion/station/{id} ----------
class StationCongestion(BaseModel):
    station_id: str
    name: str
    time: datetime
    station_congestion: int
    level: str
    congestion_pct: float | None = None
    congestion_label: str | None = None
    congestion_color: str | None = None
    prob_increase: float | None = None
    prob_normal: float | None = None
    prob_decrease: float | None = None
    source: str | None = None


# ---------- /congestion/hourly (ODsay 없음 — 모델만) ----------
class HourlyCongestionPoint(BaseModel):
    hour: int
    rate: int
    level: str
    congestion_pct: float | None = None
    source: str | None = None


class HourlyCongestionResponse(BaseModel):
    name: str
    date: str
    source: str
    points: list[HourlyCongestionPoint]


# ---------- /congestion/batch (ODsay 없음 — 모델만, 슬라이더용) ----------
class BatchCongestionRequest(BaseModel):
    names: list[str]
    departure_time: datetime


class BatchCongestionItem(BaseModel):
    name: str
    station_congestion: int
    level: str
    congestion_pct: float | None = None
    source: str | None = None


class BatchCongestionResponse(BaseModel):
    departure_time: datetime
    source: str
    stations: list[BatchCongestionItem]
