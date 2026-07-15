"""간단한 인메모리 TTL 캐시."""

from __future__ import annotations

import time
from typing import Any

_bucket: dict[str, tuple[float, Any]] = {}


def cache_get(key: str, ttl_sec: float) -> Any | None:
    entry = _bucket.get(key)
    if entry is None:
        return None
    stored_at, value = entry
    if time.monotonic() - stored_at > ttl_sec:
        _bucket.pop(key, None)
        return None
    return value


def cache_set(key: str, value: Any) -> None:
    _bucket[key] = (time.monotonic(), value)
