import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.config import Settings


def test_health_reports_ok(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_reports_database_failure(client: TestClient, settings: Settings) -> None:
    settings.db_path.unlink()  # sqlite then opens an empty database without the users table

    response = client.get("/api/health")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


def test_login_stub_accepts_any_credentials(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"email": "ada@example.com", "password": "x"})

    assert response.status_code == 200
    assert response.json() == {"email": "ada@example.com"}


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"email": "ada@example.com"},
        {"email": "ada@example.com", "password": ""},
        {"email": "not-an-email", "password": "x"},
        {"email": "", "password": "x"},
    ],
)
def test_login_rejects_malformed_requests(client: TestClient, body: dict) -> None:
    response = client.post("/api/auth/login", json=body)

    assert response.status_code == 422


def test_login_does_not_store_users(client: TestClient, settings: Settings) -> None:
    client.post("/api/auth/login", json={"email": "ada@example.com", "password": "x"})

    with sqlite3.connect(settings.db_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


@pytest.mark.parametrize("method", ["get", "post"])
def test_unknown_api_path_is_a_json_404(client: TestClient, method: str) -> None:
    response = getattr(client, method)("/api/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}
