"""요청/응답 데이터 형식(스키마) 정의.

FastAPI는 여기 적힌 형식을 읽어서 /docs 문서를 자동으로 만들어줍니다.
프론트가 주고받을 JSON 모양이 곧 이 파일입니다.
"""

from datetime import datetime
from pydantic import BaseModel


# ---------- 공통 헬퍼 ----------
def congestion_level(value: int) -> str:
    """혼잡도 지수(0~100)를 단계 라벨로 변환. (명세 2번 표 기준)"""
    if value <= 40:
        return "여유"
    if value <= 65:
        return "보통"
    if value <= 80:
        return "주의"
    return "혼잡"


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
    train_congestion: int      # 열차 혼잡도
    level: str


class RouteStation(BaseModel):
    station_id: str
    name: str
    line: str
    station_congestion: int    # 역사 내 혼잡도
    level: str
    is_transfer: bool


class RouteSummary(BaseModel):
    total_time_min: int
    transfer_count: int
    payment: int | None = None
    overall_congestion: int
    overall_level: str


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