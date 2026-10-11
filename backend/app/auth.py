"""Passwords, sessions and the signed-in user.

Passwords are hashed with scrypt; a session is a random token kept in an HttpOnly cookie, of which
only a SHA-256 hash is stored.
"""

import hashlib
import hmac
import secrets
import sqlite3
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.db import get_conn
from app.schemas import User

SESSION_COOKIE = "prelegal_session"
SESSION_LIFETIME = timedelta(days=7)
_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt, digest = stored.split("$")
        expected = bytes.fromhex(digest)
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), **_SCRYPT)
    except ValueError:
        return False
    return scheme == "scrypt" and hmac.compare_digest(actual, expected)


# Checked against when the email is unknown, so a login takes as long whether or not it exists.
DUMMY_HASH = hash_password(secrets.token_hex(16))


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


def create_session(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with conn:
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (_token_hash(token), user_id, (_now() + SESSION_LIFETIME).isoformat()),
        )
    return token


def delete_session(conn: sqlite3.Connection, token: str) -> None:
    with conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))


def current_user(request: Request, conn: Annotated[sqlite3.Connection, Depends(get_conn)]) -> User:
    """FastAPI dependency: the user of the request's session, or 401."""
    token = request.cookies.get(SESSION_COOKIE)
    row = token and conn.execute(
        "SELECT users.id, users.email, sessions.expires_at FROM sessions"
        " JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?",
        (_token_hash(token),),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Not signed in")
    if datetime.fromisoformat(row["expires_at"]) <= _now():
        delete_session(conn, token)
        raise HTTPException(status_code=401, detail="Your session has expired")
    return User(id=row["id"], email=row["email"])


CurrentUser = Annotated[User, Depends(current_user)]
