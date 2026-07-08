"""가짜(mock) 데이터와 가짜 예측 로직.

★ 여기가 나중에 실제로 교체될 부분입니다 ★
- STATIONS   -> 데이터팀 데이터를 담은 DB 조회로 교체
- 혼잡도 값  -> 모델팀의 .pkl 모델 예측 결과로 교체
지금은 프론트가 화면을 먼저 만들 수 있게 그럴듯한 가짜 값을 돌려줍니다.
"""

from app.schemas import congestion_level

# 역 목록 (실제로는 데이터팀 데이터 → DB에서 조회)
STATIONS = [
    {"station_id": "222", "name": "강남", "lines": ["2호선"]},
    {"station_id": "223", "name": "역삼", "lines": ["2호선"]},
    {"station_id": "331", "name": "교대", "lines": ["2호선", "3호선"]},
    {"station_id": "220", "name": "삼성", "lines": ["2호선"]},
    {"station_id": "426", "name": "서울역", "lines": ["1호선", "4호선"]},
    {"station_id": "239", "name": "홍대입구", "lines": ["2호선"]},
    {"station_id": "216", "name": "잠실", "lines": ["2호선", "8호선"]},
]


def _base_congestion(hour: int) -> int:
    """시간대에 따라 기본 혼잡도를 다르게. (출퇴근 시간이 더 붐빔)"""
    if hour in (7, 8, 9, 18, 19, 20):   # 출퇴근 러시아워
        return 82
    if hour in (6, 10, 17, 21, 22):     # 준혼잡
        return 60
    return 42                            # 평시


def build_mock_route(start: str, end: str, hour: int) -> dict:
    """출발/도착/시간으로 가짜 경로 + 혼잡도를 생성.

    실제로는: 노선 그래프에서 최단경로를 찾고(경로 탐색),
    각 역/구간마다 모델을 호출해(예측 서빙) 값을 채웁니다.
    """
    base = _base_congestion(hour)

    # 가짜 경로: 출발 → (교대 환승) → 도착
    path = [start]
    if start != "교대" and end != "교대":
        path.append("교대")
    path.append(end)

    # 구간별 열차 혼잡도
    segments = []
    for i in range(len(path) - 1):
        c = min(base + i * 5, 100)
        segments.append({
            "line": "2호선" if i == 0 else "3호선",
            "from_station": path[i],
            "to_station": path[i + 1],
            "train_congestion": c,
            "level": congestion_level(c),
        })

    # 역별 역사 내 혼잡도
    stations = []
    for i, name in enumerate(path):
        c = min(base + i * 4, 100)
        is_transfer = name == "교대"
        stations.append({
            "station_id": _find_id(name),
            "name": name,
            "line": "3호선" if is_transfer else "2호선",
            "station_congestion": c,
            "level": congestion_level(c),
            "is_transfer": is_transfer,
        })

    overall = min(base + 6, 100)
    return {
        "summary": {
            "total_time_min": len(path) * 14,
            "transfer_count": sum(1 for s in stations if s["is_transfer"]),
            "overall_congestion": overall,
            "overall_level": congestion_level(overall),
        },
        "segments": segments,
        "stations": stations,
    }


def _find_id(name: str) -> str:
    for s in STATIONS:
        if s["name"] == name:
            return s["station_id"]
    return "000"  # 목록에 없는 역이면 임시 ID