import sqlite3
import time
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.auth import SESSION_COOKIE, hash_password, verify_password
from app.config import Settings
from tests.conftest import PASSWORD, sign_up


def test_password_hashing() -> None:
    stored = hash_password("s3cret-pass")

    assert stored.startswith("scrypt$") and "s3cret-pass" not in stored
    assert verify_password("s3cret-pass", stored)
    assert not verify_password("wrong-pass", stored)
    assert hash_password("s3cret-pass") != stored  # salted
    assert not verify_password("s3cret-pass", "not a hash")


def test_signup_signs_the_user_in(client: TestClient, settings: Settings) -> None:
    response = client.post("/api/auth/signup", json={"email": " Ada@Example.com ", "password": PASSWORD})

    assert response.status_code == 201
    assert response.json() == {"id": 1, "email": "ada@example.com"}
    cookie = response.headers["set-cookie"]
    assert f"{SESSION_COOKIE}=" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert client.get("/api/auth/me").json() == {"id": 1, "email": "ada@example.com"}
    with sqlite3.connect(settings.db_path) as conn:
        stored = conn.execute("SELECT password_hash FROM users").fetchone()[0]
    assert PASSWORD not in stored


def test_signup_rejects_taken_emails(client: TestClient) -> None:
    sign_up(client, "ada@example.com")

    response = client.post("/api/auth/signup", json={"email": "ADA@example.com", "password": PASSWORD})

    assert response.status_code == 409
    assert response.json() == {"detail": "An account with this email already exists."}


@pytest.mark.parametrize(
    "body",
    [
        {"email": "ada@example.com", "password": "short"},
        {"email": "not-an-email", "password": PASSWORD},
        {"email": "ada@example.com", "password": "x" * 129},
        {"email": "ada@example.com"},
    ],
)
def test_signup_validates_input(client: TestClient, body: dict) -> None:
    assert client.post("/api/auth/signup", json=body).status_code == 422


def test_login_and_logout(client: TestClient) -> None:
    sign_up(client)
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401

    response = client.post("/api/auth/login", json={"email": "ADA@example.com", "password": PASSWORD})

    assert response.status_code == 200
    assert response.json()["email"] == "ada@example.com"
    assert client.get("/api/auth/me").status_code == 200


@pytest.mark.parametrize("email", ["ada@example.com", "nobody@example.com"])
def test_login_failures_look_the_same(client: TestClient, email: str) -> None:
    sign_up(client)
    client.cookies.clear()

    response = client.post("/api/auth/login", json={"email": email, "password": "wrong password"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password."}
    assert client.get("/api/auth/me").status_code == 401


def test_logout_ends_the_session_on_the_server(client: TestClient) -> None:
    sign_up(client)
    token = client.cookies[SESSION_COOKIE]

    assert client.post("/api/auth/logout").status_code == 204
    client.cookies.set(SESSION_COOKIE, token)  # replaying the old cookie no longer works

    assert client.get("/api/auth/me").status_code == 401


def test_logout_without_a_session(client: TestClient) -> None:
    assert client.post("/api/auth/logout").status_code == 204


def test_expired_sessions_are_rejected(client: TestClient, settings: Settings) -> None:
    sign_up(client)
    with sqlite3.connect(settings.db_path) as conn:
        conn.execute("UPDATE sessions SET expires_at = ?", ((datetime.now(UTC) - timedelta(minutes=1)).isoformat(),))

    response = client.get("/api/auth/me")

    assert response.status_code == 401
    with sqlite3.connect(settings.db_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0


def test_forged_cookie_is_rejected(client: TestClient) -> None:
    client.cookies.set(SESSION_COOKIE, "forged")

    assert client.get("/api/auth/me").status_code == 401


def test_secure_cookie_setting(settings: Settings, fake_llm) -> None:
    from dataclasses import replace

    from app.main import create_app

    with TestClient(create_app(replace(settings, cookie_secure=True), llm=fake_llm)) as client:
        response = client.post("/api/auth/signup", json={"email": "ada@example.com", "password": PASSWORD})

    assert "Secure" in response.headers["set-cookie"]


def test_unencodable_passwords_are_rejected(client: TestClient) -> None:
    # A lone surrogate is valid JSON but not valid UTF-8.
    body = r'{"email": "ada@example.com", "password": "correct horse \ud800"}'

    response = client.post("/api/auth/signup", content=body, headers={"Content-Type": "application/json"})

    assert response.status_code == 422


def test_repeated_failed_logins_are_throttled(client: TestClient) -> None:
    sign_up(client)
    client.cookies.clear()
    wrong = {"email": "ada@example.com", "password": "wrong password"}

    statuses = [client.post("/api/auth/login", json=wrong).status_code for _ in range(6)]
    right = client.post("/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD})

    assert statuses == [401] * 5 + [429]
    assert right.status_code == 429  # locked for a while, even with the right password
    assert "Too many failed sign-in attempts" in right.json()["detail"]
    # Other accounts are unaffected.
    assert client.post("/api/auth/login", json={"email": "eve@example.com", "password": "x"}).status_code == 401


def test_successful_login_resets_the_failure_count(client: TestClient) -> None:
    sign_up(client)
    wrong = {"email": "ada@example.com", "password": "wrong password"}
    for _ in range(4):
        client.post("/api/auth/login", json=wrong)

    assert client.post("/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD}).status_code == 200
    assert [client.post("/api/auth/login", json=wrong).status_code for _ in range(5)] == [401] * 5


def test_repeated_signups_are_throttled(client: TestClient) -> None:
    statuses = [
        client.post("/api/auth/signup", json={"email": f"user{n}@example.com", "password": PASSWORD}).status_code
        for n in range(11)
    ]

    assert statuses == [201] * 10 + [429]


def test_rate_limiter_window() -> None:
    from app.ratelimit import RateLimiter

    limiter = RateLimiter(2, 0.05, "slow down")
    limiter.hit("k")
    limiter.hit("k")
    with pytest.raises(HTTPException):
        limiter.check("k")
    time.sleep(0.06)
    limiter.check("k")  # the attempts have expired


def test_validation_errors_do_not_echo_passwords(client: TestClient) -> None:
    response = client.post("/api/auth/signup", json={"email": "ada@example.com", "password": "short1"})

    assert response.status_code == 422
    assert "short1" not in response.text
    assert response.json()["detail"][0]["loc"] == ["body", "password"]
