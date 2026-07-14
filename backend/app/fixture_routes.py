"""ODsay 응답 JSON 픽스처 — API 키 없이 경로 목업에 사용."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[2]
_FIXTURE_DIR = _REPO_ROOT / "src" / "lib" / "fixtures"

# (정규화 출발, 정규화 도착) → 파일명
_DEMO_PAIRS: dict[tuple[str, str], str] = {
    ("시청", "동대문"): "odsay-cityhall-dongdaemun.json",
    ("사당", "종로3가"): "odsay-sadang-jongno3.json",
    ("서울", "왕십리"): "odsay-seoul-wangsimni.json",
    ("서울역", "왕십리"): "odsay-seoul-wangsimni.json",
    ("합정", "잠실"): "odsay-hapjeong-jamsil.json",
}


def _norm(name: str) -> str:
    s = (name or "").strip()
    s = re.sub(r"역$", "", s)
    return s


@lru_cache(maxsize=8)
def _load_json(filename: str) -> dict[str, Any] | None:
    path = _FIXTURE_DIR / filename
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def find_fixture_payload(start: str, end: str) -> dict[str, Any] | None:
    key = (_norm(start), _norm(end))
    filename = _DEMO_PAIRS.get(key)
    if not filename:
        # 서울역 ↔ 서울 별칭
        if key[0] == "서울역":
            filename = _DEMO_PAIRS.get(("서울", key[1]))
        elif key[0] == "서울":
            filename = _DEMO_PAIRS.get(("서울역", key[1]))
    if not filename:
        return None
    return _load_json(filename)


def list_demo_pairs() -> list[dict[str, str]]:
    return [
        {"start": a, "end": b, "file": f}
        for (a, b), f in _DEMO_PAIRS.items()
        if a != "서울"  # 중복 표기 제외
    ]
