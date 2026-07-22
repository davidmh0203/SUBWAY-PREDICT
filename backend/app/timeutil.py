"""Asia/Seoul 벽시계 정규화.

프론트가 Date#toISOString()(UTC Z)로 보내면 시·분이 9시간 밀린다.
- aware datetime → Asia/Seoul로 변환
- naive datetime → 이미 한국 벽시계로 간주
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")


def as_kst(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=KST)
    return dt.astimezone(KST)


def kst_naive(dt: datetime) -> datetime:
    """모델·슬롯 계산용 — tz 없는 KST 벽시계."""
    k = as_kst(dt)
    return k.replace(tzinfo=None)
