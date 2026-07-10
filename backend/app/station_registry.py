"""정규 역 레지스트리 (canonical station registry).

이 모듈이 프로젝트 전체 통합의 '조인 키' 역할을 합니다.

왜 필요한가:
- ODsay 경로는 ODsay 고유 stationID / laneName 으로 옵니다.
- 데이터팀 혼잡도 테이블은 (호선, 역번호, 역명, 상하선, 30분) 으로 키가 잡혀 있습니다.
- 프론트 지도는 역명 → SVG(x,y) 로만 씁니다.
이 셋을 하나로 이어주는 '정규 키'가 (line, name_norm) 입니다.

정규 키의 출처:
  혼잡도 데이터셋의 (호선, 역번호, 역명) 컬럼에서 그대로 생성합니다.
  → 조회 시점에 같은 테이블과 조인하므로 매칭이 100% 맞습니다.
  (scripts/build_registry.py 가 CSV → data/stations.json 을 만듭니다.)

이 모듈은 '키 계산'만 책임집니다. 실제 혼잡도 값 조회(lookup)는
다음 단계(congestion lookup 레이어)에서 이 키를 받아 처리합니다.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

_DATA_PATH = Path(__file__).resolve().parent / "data" / "stations.json"

# 이 프로젝트가 혼잡도를 제공하는 호선 (서울교통공사 1~8호선 데이터셋 범위)
SUPPORTED_LINES = {"1호선", "2호선", "3호선", "4호선", "5호선", "6호선", "7호선", "8호선"}


# --------------------------------------------------------------------------
# 이름 / 호선 라벨 정규화
# --------------------------------------------------------------------------
def normalize_name(raw: str) -> str:
    """역명을 조인 키용으로 정규화.

    "성신여대입구(돈암)"  -> "성신여대입구"
    "이수/총신대입구"      -> "이수"        (슬래시 앞만)
    "서울역"              -> "서울"
    "  강남 "             -> "강남"
    """
    if not raw:
        return ""
    name = raw.strip()
    name = name.split("/")[0]              # 슬래시 별칭 제거
    name = re.sub(r"\(.*?\)", "", name)    # 괄호 부기명 제거
    name = re.sub(r"역$", "", name.strip())  # 끝 '역' 제거
    name = re.sub(r"\s+", "", name)        # 내부 공백 제거
    return name.strip()


_LINE_RE = re.compile(
    r"(\d호선|신분당선|경의중앙선|공항철도|경춘선|수인분당선|수인\.분당선"
    r"|에버라인|우이신설|김포골드|신림선|GTX-[A-Z]|서해선)"
)


def line_label(lane_name: str | None) -> str:
    """ODsay laneName / 데이터셋 호선표기 -> 정규 호선 라벨.

    "수도권 2호선"      -> "2호선"
    "수인.분당선"       -> "수인분당선"
    None / 매칭 실패    -> "지하철"
    """
    if not lane_name:
        return "지하철"
    m = _LINE_RE.search(str(lane_name))
    if m:
        return m.group(1).replace("수인.분당선", "수인분당선")
    return str(lane_name).replace("수도권 ", "").strip()


def _line_from_number(raw: str | int) -> str:
    """데이터셋 '호선' 컬럼이 숫자(2)거나 '2호선' 문자열일 수 있어 통일."""
    s = str(raw).strip()
    if s.endswith("호선"):
        return s
    if s.isdigit():
        return f"{s}호선"
    return line_label(s)


# --------------------------------------------------------------------------
# 시간대 버킷 / 요일구분  (혼잡도 테이블 조회 파라미터)
# --------------------------------------------------------------------------
def daytype(dt: datetime) -> str:
    """혼잡도 데이터셋의 요일구분: 평일 / 토요일 / 일요일.

    NOTE: 공휴일은 일요일 취급이 데이터셋 관행이지만, 정확히 하려면
    공휴일 목록으로 보정 필요 (후속 개선 포인트).
    """
    wd = dt.weekday()  # 월=0 ... 일=6
    if wd == 5:
        return "토요일"
    if wd == 6:
        return "일요일"
    return "평일"


def time_bucket(dt: datetime) -> str:
    """30분 단위 버킷 라벨 'HH:MM' (예: 08:14 -> '08:00', 08:41 -> '08:30').

    빌드 스크립트가 CSV의 30분 컬럼 헤더를 이 'HH:MM' 형태로 맞춰줍니다.
    """
    minute = 0 if dt.minute < 30 else 30
    return f"{dt.hour:02d}:{minute:02d}"


# --------------------------------------------------------------------------
# 레지스트리 로드 & 조회
# --------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _load() -> dict[str, Any]:
    """data/stations.json 을 읽어 조회용 인덱스를 만든다 (프로세스당 1회)."""
    rows: list[dict[str, Any]] = []
    if _DATA_PATH.exists():
        with _DATA_PATH.open(encoding="utf-8") as f:
            rows = json.load(f)

    by_key: dict[tuple[str, str], dict[str, Any]] = {}
    by_name: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        line = _line_from_number(r.get("line", ""))
        nname = r.get("name_norm") or normalize_name(r.get("name", ""))
        r = {**r, "line": line, "name_norm": nname}
        by_key[(line, nname)] = r
        by_name.setdefault(nname, []).append(r)

    # 환승역 표시: 같은 정규역명이 2개 이상 호선에 있으면 환승
    for nname, group in by_name.items():
        lines = {g["line"] for g in group}
        is_t = len(lines) > 1
        for g in group:
            g["is_transfer"] = g.get("is_transfer", is_t) or is_t

    return {"by_key": by_key, "by_name": by_name, "count": len(rows)}


def resolve(line: str | int, name: str) -> dict[str, Any] | None:
    """(호선, 역명) -> 레지스트리 행. 없으면 None."""
    idx = _load()
    key = (_line_from_number(line), normalize_name(name))
    return idx["by_key"].get(key)


def resolve_by_name(name: str) -> list[dict[str, Any]]:
    """역명만으로 조회 (호선을 아직 모를 때 / 환승역 판정용). 여러 호선 반환."""
    idx = _load()
    return idx["by_name"].get(normalize_name(name), [])


def is_supported(line: str | int) -> bool:
    """이 호선의 혼잡도 데이터를 우리가 갖고 있는지 (1~8호선만)."""
    return _line_from_number(line) in SUPPORTED_LINES


def stats() -> dict[str, Any]:
    """레지스트리 로드 상태 (디버그/헬스체크용)."""
    idx = _load()
    return {"stations": idx["count"], "unique_names": len(idx["by_name"])}


# --------------------------------------------------------------------------
# 방향(상선/하선) 판정  ★ 통합에서 제일 까다로운 부분 ★
# --------------------------------------------------------------------------
def resolve_direction(line: str, from_name: str, to_name: str) -> str | None:
    """진행 방향 -> 데이터셋 '상하선구분' 라벨.

    아직 스텁입니다. 실제로는 호선별 '기준 역 순서'가 필요합니다:
      - 각 호선의 상행(또는 상선) 기준 역 시퀀스를 하나 갖고 있으면,
        from_name 의 index < to_name 의 index 인지로 상/하선을 정합니다.
      - 2호선은 순환선이라 상/하선 대신 내선/외선 → 별도 규칙.

    build_registry.py 가 각 행에 'seq'(호선 내 순번)를 넣어주면
    여기서 두 역의 seq 비교만으로 방향을 판정할 수 있습니다.
    """
    a = resolve(line, from_name)
    b = resolve(line, to_name)
    if not a or not b or "seq" not in a or "seq" not in b:
        return None
    if line == "2호선":
        return "외선" if a["seq"] < b["seq"] else "내선"
    return "하선" if a["seq"] < b["seq"] else "상선"
