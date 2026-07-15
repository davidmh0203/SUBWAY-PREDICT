#!/usr/bin/env python3
"""GET /forecast/cards 스모크 (ODsay 0회)."""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
KST = ZoneInfo("Asia/Seoul")


async def main() -> int:
    from app.forecast_service import build_forecast_cards

    now = datetime.now(KST)
    cases = [
        ("now", {"at": now}),
        (
            "gangnam-now",
            {
                "lat": 37.4979,
                "lng": 127.0276,
                "stations": ["강남", "역삼"],
                "at": now,
            },
        ),
    ]
    ok = True
    for name, kwargs in cases:
        result = await build_forecast_cards(**kwargs)
        cards = result.get("cards") or []
        cats = {c.get("category") for c in cards}
        print(f"\n=== {name} cards={len(cards)} sources={result.get('sources')} ===")
        for c in cards[:6]:
            print(f"  p{c['priority']} {c['emoji']} {c['title']}")
            print(f"     {c['summary'][:90]}")
        if len(cards) < 1:
            print("FAIL: expected >=1 card")
            ok = False
        # 집회/돌발 없으면 empty-* 카드가 있어야 함
        has_event = any(
            c.get("category") in ("protest", "event", "disruption") for c in cards
        )
        has_empty = any(
            str(c.get("category", "")).startswith("empty") for c in cards
        )
        if not has_event and not has_empty:
            print("FAIL: no event cards and no empty-* notice cards", cats)
            ok = False
    print("\nOK" if ok else "\nFAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
