#!/usr/bin/env python3
"""ODsay 키 없이 /predict/route 목업+모델 스모크 테스트.

Usage (repo root):
  ODSAY_FORCE_MOCK=1 backend/.venv/bin/python scripts/smoke-mock-predict.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)
os.environ.setdefault("ODSAY_FORCE_MOCK", "1")

from app.odsay_client import is_configured  # noqa: E402
from app.odsay_service import predict_route_with_odsay  # noqa: E402


async def main() -> int:
    print("is_configured (should be False under FORCE_MOCK):", is_configured())
    pairs = [
        ("시청", "동대문"),
        ("합정", "잠실"),
        ("강남", "홍대입구"),  # 픽스처 없음 → 단순 목업
    ]
    when = datetime(2025, 7, 11, 18, 30)
    for start, end in pairs:
        body = await predict_route_with_odsay(start, end, when)
        stations = body.get("stations") or []
        alts = body.get("alternatives") or []
        summary = body.get("summary") or {}
        sources = {s.get("source") for s in stations}
        print(
            f"\n{start} → {end}: stations={len(stations)} alts={len(alts)} "
            f"overall={summary.get('overall_congestion')} "
            f"level={summary.get('overall_level')} "
            f"model_source={summary.get('model_source')} "
            f"station_sources={sources}"
        )
        if stations:
            sample = stations[min(1, len(stations) - 1)]
            print(
                f"  sample: {sample.get('name')} "
                f"{sample.get('station_congestion')}% {sample.get('level')}"
            )
    print("\nOK")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
