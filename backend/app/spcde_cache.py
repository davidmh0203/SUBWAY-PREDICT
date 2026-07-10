"""한국천문연구원 특일 정보 API 응답 인메모리 TTL 캐시."""

from __future__ import annotations

import time
from typing import Any

CACHE_TTL_SEC = 86_400  # 24시간

_bucket: dict[str, tuple[float, Any]] = {}


def cache_get(key: str) -> Any | None:
    entry = _bucket.get(key)
    if entry is None:
        return None
    stored_at, value = entry
    if time.monotonic() - stored_at > CACHE_TTL_SEC:
        _bucket.pop(key, None)
        return None
    return value


def cache_set(key: str, value: Any) -> None:
    _bucket[key] = (time.monotonic(), value)
