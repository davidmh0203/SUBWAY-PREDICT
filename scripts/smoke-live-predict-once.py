#!/usr/bin/env python3
"""최소 ODsay 호출로 /predict/route 라이브 스모크 (1 OD만).

기본: searchStation×2 + searchPubTransPathT×1 = 최대 3회.
캐시 hit 시 0회 추가.

Usage:
  ODSAY_FORCE_MOCK=0 backend/.venv/bin/python scripts/smoke-live-predict-once.py
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

# .env 로드 전에 mock 강제 OFF (테스트 의도)
os.environ["ODSAY_FORCE_MOCK"] = "0"

import app.odsay_client as odsay_client  # noqa: E402
from app.odsay_client import is_configured  # noqa: E402
from app.odsay_service import predict_route_with_odsay  # noqa: E402

_calls: list[str] = []
_orig = odsay_client.call_odsay


async def _counting_call(path: str, params=None):
    _calls.append(path)
    print(f"  [ODsay #{len(_calls)}] {path}")
    return await _orig(path, params)


odsay_client.call_odsay = _counting_call


async def main() -> int:
    if not is_configured():
        print("FAIL: ODsay not configured (key missing or FORCE_MOCK still on)")
        return 1

    # 한 쌍만. 캐시 키도 이 시각/시간대에 묶임.
    start, end = "합정", "잠실"
    when = datetime(2025, 7, 11, 18, 30)
    print(f"LIVE smoke: {start} → {end} @ {when.isoformat()}")
    print("(expect ≤3 ODsay calls: station×2 + path×1)\n")

    body = await predict_route_with_odsay(start, end, when)
    stations = body.get("stations") or []
    alts = body.get("alternatives") or []
    summary = body.get("summary") or {}

    print("\n--- result ---")
    print(f"ODsay calls: {len(_calls)} → {_calls}")
    print(
        f"stations={len(stations)} alts={len(alts)} "
        f"time={summary.get('total_time_min')}min "
        f"overall={summary.get('overall_congestion')}% "
        f"{summary.get('overall_level')} "
        f"model_source={summary.get('model_source')}"
    )
    for s in stations[:5]:
        print(
            f"  {s.get('name')}: {s.get('station_congestion')}% "
            f"{s.get('level')} src={s.get('source')}"
        )
    if len(stations) > 5:
        print(f"  … +{len(stations) - 5} more")

    ok = (
        len(_calls) <= 3
        and len(stations) >= 2
        and summary.get("model_source") == "model"
        and all(s.get("source") == "model" for s in stations[:3])
        and stations[0].get("name") not in ("string", None, "")
    )
    # 2nd call should be cache (0 new ODsay)
    n1 = len(_calls)
    await predict_route_with_odsay(start, end, when)
    print(f"\nrepeat same OD (cache): +{len(_calls) - n1} ODsay calls (want 0)")
    ok = ok and (len(_calls) - n1 == 0)

    print("\n" + ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
