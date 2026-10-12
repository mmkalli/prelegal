from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.conftest import REGISTRY_PATH, TEMPLATES_DIR


@pytest.mark.parametrize(
    ("path", "text"),
    [("/", "entry"), ("/login/", "login page"), ("/documents/", "documents page"), ("/documents/edit/", "editor page")],
)
def test_serves_exported_pages(client: TestClient, path: str, text: str) -> None:
    response = client.get(path)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert text in response.text


def test_redirects_routes_without_trailing_slash(client: TestClient) -> None:
    response = client.get("/login", follow_redirects=False)

    assert response.status_code in (301, 307)
    assert response.headers["location"].endswith("/login/")


def test_serves_assets(client: TestClient) -> None:
    response = client.get("/_next/static/chunk.js")

    assert response.status_code == 200
    assert "chunk" in response.text


def test_unknown_page_uses_frontend_404(client: TestClient) -> None:
    response = client.get("/no-such-page/")

    assert response.status_code == 404
    assert "page not found" in response.text


def test_does_not_serve_files_outside_static_dir(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "secret.txt").write_text("top secret")

    response = client.get("/..%2fsecret.txt")

    assert "top secret" not in response.text


def test_runs_api_only_without_static_dir(tmp_path: Path) -> None:
    settings = Settings(
        db_path=tmp_path / "prelegal.db",
        static_dir=tmp_path / "missing",
        registry_path=REGISTRY_PATH,
        templates_dir=TEMPLATES_DIR,
    )

    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404
