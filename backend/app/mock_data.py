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

# mock 경로용 역→호선 (하드코딩 2호선 방지)
STATION_LINES: dict[str, list[str]] = {
    "강남": ["2호선"],
    "역삼": ["2호선"],
    "교대": ["2호선", "3호선"],
    "삼성": ["2호선"],
    "서울역": ["1호선", "4호선"],
    "홍대입구": ["2호선"],
    "잠실": ["2호선", "8호선"],
    "고속터미널": ["3호선", "7호선"],
    "연신내": ["3호선", "6호선"],
    "원흥": ["3호선"],
    "원당": ["3호선"],
    "삼송": ["3호선"],
    "지축": ["3호선"],
    "시청": ["1호선", "2호선"],
    "동대문": ["1호선", "4호선"],
    "사당": ["2호선", "4호선"],
    "종로3가": ["1호선", "3호선", "5호선"],
    "합정": ["2호선", "6호선"],
    "왕십리": ["2호선", "5호선"],
}

NEUTRAL_LINE = "지하철"


def _norm_name(name: str) -> str:
    return (name or "").strip().removesuffix("역")


def _lines_for(name: str) -> list[str]:
    return STATION_LINES.get(_norm_name(name), [])


def _guess_line(from_name: str, to_name: str) -> str:
    a = _lines_for(from_name)
    b = _lines_for(to_name)
    for line in a:
        if line in b:
            return line
    if a:
        return a[0]
    if b:
        return b[0]
    return NEUTRAL_LINE


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
    start_n = _norm_name(start)
    end_n = _norm_name(end)

    # 가짜 경로: 공통 호선이 있으면 직행, 없으면 교대 환승
    shared = _guess_line(start_n, end_n)
    path = [start_n]
    if shared == NEUTRAL_LINE or (
        shared not in _lines_for(start_n) or shared not in _lines_for(end_n)
    ):
        # 공통 호선이 불명확하면 교대 경유 (기존 데모 패턴)
        if start_n != "교대" and end_n != "교대":
            path.append("교대")
    path.append(end_n)

    segments = []
    for i in range(len(path) - 1):
        c = min(base + i * 5, 100)
        line = _guess_line(path[i], path[i + 1])
        segments.append({
            "line": line,
            "from_station": path[i],
            "to_station": path[i + 1],
            "train_congestion": c,
            "level": congestion_level(c),
        })

    stations = []
    for i, name in enumerate(path):
        c = min(base + i * 4, 100)
        seg_line = segments[min(i, len(segments) - 1)]["line"] if segments else NEUTRAL_LINE
        is_transfer = i > 0 and i < len(path) - 1 and name == "교대"
        stations.append({
            "station_id": _find_id(name),
            "name": name,
            "line": seg_line,
            "station_congestion": c,
            "level": congestion_level(c),
            "is_transfer": is_transfer,
        })

    overall = min(base + 6, 100)
    return {
        "source": "mock",
        "summary": {
            "total_time_min": len(path) * 14,
            "transfer_count": sum(1 for s in stations if s["is_transfer"]),
            "payment": 1400 + sum(1 for s in stations if s["is_transfer"]) * 50,
            "overall_congestion": overall,
            "overall_level": congestion_level(overall),
            "model_source": "mock",
        },
        "segments": segments,
        "stations": stations,
        "alternatives": [],
    }


def _find_id(name: str) -> str:
    for s in STATIONS:
        if s["name"] == name:
            return s["station_id"]
    return "000"  # 목록에 없는 역이면 임시 ID
