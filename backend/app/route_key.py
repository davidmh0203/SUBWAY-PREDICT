"""경로 식별자(route_key) 생성.

즐겨찾기가 배열 인덱스로 경로를 가리키면 안 된다 — ODsay 응답의 path 순서는
호출마다 바뀔 수 있어서, 내용 기반 키(호선·환승역 시퀀스)로 같은 경로인지 판별한다.
"""

from __future__ import annotations

from typing import Any


def build_route_key(segments: list[dict[str, Any]]) -> str:
    """segments의 (line, 환승역) 시퀀스로 route_key 생성. 예: "2호선>사당>4호선" """
    if not segments:
        return ""
    parts = [segments[0]["line"]]
    for prev, curr in zip(segments, segments[1:]):
        if curr["line"] != prev["line"]:
            parts.append(prev["to_station"])
            parts.append(curr["line"])
    return ">".join(parts)


def build_route_label(segments: list[dict[str, Any]]) -> str:
    """사람이 읽는 라벨. 예: "2호선 · 환승 1회" """
    if not segments:
        return ""
    first_line = segments[0]["line"]
    transfer_count = sum(
        1 for prev, curr in zip(segments, segments[1:]) if curr["line"] != prev["line"]
    )
    return f"{first_line} · 환승 {transfer_count}회"
