"""Limits repeated sign-in and sign-up attempts, against password guessing and email probing.

Attempts are recorded in the database, so every server process shares the same counts. Like the
rest of the database, they are reset when the server restarts.
"""

import sqlite3
import time
from dataclasses import dataclass

from fastapi import HTTPException


@dataclass(frozen=True)
class RateLimit:
    """At most `limit` attempts per key within a sliding window of `window` seconds."""

    scope: str
    limit: int
    window: float
    message: str

    def _key(self, key: str) -> str:
        return f"{self.scope}:{key}"

    def check(self, conn: sqlite3.Connection, key: str) -> None:
        """Raises 429 if `key` has used up its attempts."""
        (count,) = conn.execute(
            "SELECT COUNT(*) FROM auth_attempts WHERE key = ? AND attempted_at > ?",
            (self._key(key), time.time() - self.window),
        ).fetchone()
        if count >= self.limit:
            raise HTTPException(status_code=429, detail=self.message)

    def hit(self, conn: sqlite3.Connection, key: str) -> None:
        now = time.time()
        with conn:
            # Expired attempts are no longer needed.
            conn.execute(
                "DELETE FROM auth_attempts WHERE key = ? AND attempted_at <= ?", (self._key(key), now - self.window)
            )
            conn.execute("INSERT INTO auth_attempts (key, attempted_at) VALUES (?, ?)", (self._key(key), now))

    def reset(self, conn: sqlite3.Connection, key: str) -> None:
        with conn:
            conn.execute("DELETE FROM auth_attempts WHERE key = ?", (self._key(key),))


# Failed sign-ins per email (including sign-ups with an existing email and a wrong password).
FAILED_LOGINS = RateLimit(
    "login", 5, 15 * 60, "Too many failed sign-in attempts. Please try again in 15 minutes."
)
# Sign-ups per client address, which also slows down probing which emails have accounts.
SIGNUPS = RateLimit("signup", 10, 60 * 60, "Too many sign-up attempts. Please try again later.")
