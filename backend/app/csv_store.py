"""레포 data/*.csv 인메모리 로드 (v1: DB 없음)."""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import DATA_DIR


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return [dict(row) for row in csv.DictReader(f)]


@lru_cache(maxsize=1)
def load_spatic_events() -> tuple[dict[str, str], ...]:
    rows = _read_csv(DATA_DIR / "spatic" / "assem-events.csv")
    return tuple(rows)


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
