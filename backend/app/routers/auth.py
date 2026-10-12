import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.auth import (
    DUMMY_HASH,
    SESSION_COOKIE,
    SESSION_LIFETIME,
    CurrentUser,
    create_session,
    delete_session,
    hash_password,
    verify_password,
)
from app.db import get_conn
from app.ratelimit import FAILED_LOGINS, SIGNUPS
from app.schemas import Credentials, SignupRequest, User

router = APIRouter(prefix="/api/auth", tags=["auth"])

Connection = Annotated[sqlite3.Connection, Depends(get_conn)]

INCORRECT_CREDENTIALS = "Incorrect email or password."


def _sign_in(request: Request, response: Response, conn: sqlite3.Connection, user: User) -> User:
    response.set_cookie(
        SESSION_COOKIE,
        create_session(conn, user.id),
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=request.app.state.settings.cookie_secure,
    )
    return user


def _check_password(conn: sqlite3.Connection, email: str, password: str) -> User:
    """The user with these credentials; failures count towards the email's sign-in limit."""
    FAILED_LOGINS.check(conn, email)
    row = conn.execute("SELECT id, email, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    # Unknown emails are checked against a dummy hash, so both failures take as long.
    password_ok = verify_password(password, row["password_hash"] if row else DUMMY_HASH)
    if not (row and password_ok):
        FAILED_LOGINS.hit(conn, email)
        raise HTTPException(status_code=401, detail=INCORRECT_CREDENTIALS)
    FAILED_LOGINS.reset(conn, email)
    return User(id=row["id"], email=row["email"])


@router.post("/signup", status_code=201)
def signup(body: SignupRequest, request: Request, response: Response, conn: Connection) -> User:
    """Creates the account and signs in.

    Signing up with an email that already has an account signs in with the right password and
    otherwise fails like a wrong sign-in, rather than announcing that the account exists.
    """
    client = request.client.host if request.client else "unknown"
    SIGNUPS.check(conn, client)
    SIGNUPS.hit(conn, client)
    # Both paths run scrypt once (hash or verify), so they take as long.
    if not conn.execute("SELECT 1 FROM users WHERE email = ?", (body.email,)).fetchone():
        try:
            with conn:
                cursor = conn.execute(
                    "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                    (body.email, hash_password(body.password)),
                )
            return _sign_in(request, response, conn, User(id=cursor.lastrowid, email=body.email))
        except sqlite3.IntegrityError:
            pass  # created by a concurrent request in the meantime
    response.status_code = 200
    return _sign_in(request, response, conn, _check_password(conn, body.email, body.password))


@router.post("/login")
def login(body: Credentials, request: Request, response: Response, conn: Connection) -> User:
    return _sign_in(request, response, conn, _check_password(conn, body.email, body.password))


@router.post("/logout", status_code=204)
def logout(request: Request, conn: Connection) -> Response:
    if token := request.cookies.get(SESSION_COOKIE):
        delete_session(conn, token)
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE)
    return response


@router.get("/me")
def me(user: CurrentUser) -> User:
    return user
