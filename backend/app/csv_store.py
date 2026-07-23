"""레포 data/*.csv 인메모리 로드 (v1: DB 없음)."""

from __future__ import annotations

import csv
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import DATA_DIR

# SPATIC 과거 CSV는 `2026.7.9`, SMPA 동기화는 `2026-07-23` — 예보 매칭 전에 통일
_DOT_DATE_RE = re.compile(r"^(\d{4})[./](\d{1,2})[./](\d{1,2})$")


def normalize_event_date(raw: str | None) -> str:
    """event_date를 YYYY-MM-DD로 정규화. 실패 시 원문 strip."""
    s = (raw or "").strip()
    if not s:
        return ""
    if len(s) == 10 and s[4] == "-" and s[7] == "-":
        return s
    m = _DOT_DATE_RE.match(s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}"
    return s


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return [dict(row) for row in csv.DictReader(f)]


@lru_cache(maxsize=1)
def load_spatic_events() -> tuple[dict[str, str], ...]:
    rows = _read_csv(DATA_DIR / "spatic" / "assem-events.csv")
    out: list[dict[str, str]] = []
    for row in rows:
        r = dict(row)
        if "event_date" in r:
            r["event_date"] = normalize_event_date(r.get("event_date"))
        out.append(r)
    return tuple(out)


@lru_cache(maxsize=1)
def load_ntce_crowd_events() -> tuple[dict[str, str], ...]:
    rows = _read_csv(DATA_DIR / "metro-ntce" / "ntce-crowd-events.csv")
    return tuple(rows)


def csv_stats() -> dict[str, Any]:
    return {
        "dataDir": str(DATA_DIR),
        "spaticRows": len(load_spatic_events()),
        "ntceCrowdRows": len(load_ntce_crowd_events()),
        "spaticExists": (DATA_DIR / "spatic" / "assem-events.csv").is_file(),
        "ntceExists": (DATA_DIR / "metro-ntce" / "ntce-crowd-events.csv").is_file(),
    }
