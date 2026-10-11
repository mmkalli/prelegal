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
from app.schemas import Credentials, SignupRequest, User

router = APIRouter(prefix="/api/auth", tags=["auth"])

Connection = Annotated[sqlite3.Connection, Depends(get_conn)]


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


@router.post("/signup", status_code=201)
def signup(body: SignupRequest, request: Request, response: Response, conn: Connection) -> User:
    limiter = request.app.state.signup_limiter
    client = request.client.host if request.client else "unknown"
    limiter.check(client)
    limiter.hit(client)
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (body.email, hash_password(body.password)),
            )
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from error
    return _sign_in(request, response, conn, User(id=cursor.lastrowid, email=body.email))


@router.post("/login")
def login(body: Credentials, request: Request, response: Response, conn: Connection) -> User:
    limiter = request.app.state.login_limiter
    limiter.check(body.email)
    row = conn.execute("SELECT id, email, password_hash FROM users WHERE email = ?", (body.email,)).fetchone()
    # Unknown emails are checked against a dummy hash, so both failures take as long.
    password_ok = verify_password(body.password, row["password_hash"] if row else DUMMY_HASH)
    if not (row and password_ok):
        limiter.hit(body.email)
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    limiter.reset(body.email)
    return _sign_in(request, response, conn, User(id=row["id"], email=row["email"]))


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
