import threading
import time
from collections import defaultdict, deque


class SlidingWindowRateLimiter:
    """Small in-process limiter for low-volume authenticated write endpoints."""

    def __init__(self, *, window_seconds: int, max_requests: int):
        self.window_seconds = max(1, window_seconds)
        self.max_requests = max(1, max_requests)
        self._buckets: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        window_start = now - self.window_seconds
        with self._lock:
            bucket = self._buckets[key]
            while bucket and bucket[0] < window_start:
                bucket.popleft()
            if len(bucket) >= self.max_requests:
                return False
            bucket.append(now)
            return True

    def clear(self) -> None:
        with self._lock:
            self._buckets.clear()
