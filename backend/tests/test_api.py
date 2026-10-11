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


@pytest.mark.parametrize("method", ["get", "post"])
def test_unknown_api_path_is_a_json_404(client: TestClient, method: str) -> None:
    response = getattr(client, method)("/api/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}
