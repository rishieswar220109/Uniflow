"""In-process sliding-window rate limiting for authentication endpoints.

The limiter is deliberately small and dependency-free. It protects requests
handled by one backend process. Deployments with multiple workers or replicas
must also enforce limits at the edge or with a shared store such as Redis.
"""

from __future__ import annotations

import threading
import time
from collections import deque


class SlidingWindowRateLimiter:
    """Record request timestamps per key and allow a fixed number per window."""

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str, *, limit: int, window_seconds: int) -> float | None:
        """Record a request for ``key``.

        Returns ``None`` when the request is allowed, or the number of seconds
        the caller should wait before retrying when the limit is exhausted.
        """

        if limit <= 0 or window_seconds <= 0:
            return None

        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            events = self._events.get(key)
            if events is None:
                events = deque()
                self._events[key] = events
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                return max(0.0, events[0] + window_seconds - now)
            events.append(now)
            return None

    def reset(self) -> None:
        """Forget every recorded request (used between tests)."""

        with self._lock:
            self._events.clear()


auth_rate_limiter = SlidingWindowRateLimiter()
