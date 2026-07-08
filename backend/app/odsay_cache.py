"""ODsay API 응답 인메모리 TTL 캐시."""

from __future__ import annotations

import time
from typing import Any, TypeVar

T = TypeVar("T")

CACHE_TTL_SEC = 300

_caches: dict[str, dict[str, tuple[float, Any]]] = {
    "station": {},
    "path": {},
    "route": {},
}


def cache_get(namespace: str, key: str) -> Any | None:
    bucket = _caches.get(namespace)
    if bucket is None:
        return None
    entry = bucket.get(key)
    if entry is None:
        return None
    stored_at, value = entry
    if time.monotonic() - stored_at > CACHE_TTL_SEC:
        bucket.pop(key, None)
        return None
    return value


def cache_set(namespace: str, key: str, value: Any) -> None:
    bucket = _caches.setdefault(namespace, {})
    bucket[key] = (time.monotonic(), value)
