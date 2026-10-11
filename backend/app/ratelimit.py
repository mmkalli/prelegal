"""Limits repeated sign-in and sign-up attempts, against password guessing and email probing.

Counts are kept in memory, so they are per process and reset on restart, like the database.
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException


class RateLimiter:
    """Allows at most `limit` attempts per key within a sliding window of `window` seconds."""

    def __init__(self, limit: int, window: float, message: str) -> None:
        self.limit = limit
        self.window = window
        self.message = message
        self._attempts: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()  # endpoints run on several threadpool threads

    def _recent(self, key: str, now: float) -> deque[float]:
        attempts = self._attempts[key]
        while attempts and attempts[0] <= now - self.window:
            attempts.popleft()
        return attempts

    def check(self, key: str) -> None:
        """Raises 429 if `key` has used up its attempts."""
        with self._lock:
            if len(self._recent(key, time.monotonic())) >= self.limit:
                raise HTTPException(status_code=429, detail=self.message)

    def hit(self, key: str) -> None:
        with self._lock:
            now = time.monotonic()
            self._recent(key, now).append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._attempts.pop(key, None)


def login_limiter() -> RateLimiter:
    """Failed sign-ins per email."""
    return RateLimiter(5, 15 * 60, "Too many failed sign-in attempts. Please try again in 15 minutes.")


def signup_limiter() -> RateLimiter:
    """Sign-ups per client address, which also slows down probing which emails have accounts."""
    return RateLimiter(10, 60 * 60, "Too many sign-up attempts. Please try again later.")
