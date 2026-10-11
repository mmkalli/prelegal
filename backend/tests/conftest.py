from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def static_dir(tmp_path: Path) -> Path:
    """A minimal stand-in for the exported frontend (`next build` with trailingSlash)."""
    root = tmp_path / "static"
    for page, html in {
        "index.html": "<p>entry</p>",
        "login/index.html": "<p>login page</p>",
        "app/index.html": "<p>app page</p>",
        "404.html": "<p>page not found</p>",
        "_next/static/chunk.js": "console.log('chunk');",
    }.items():
        (root / page).parent.mkdir(parents=True, exist_ok=True)
        (root / page).write_text(html)
    return root


@pytest.fixture
def settings(tmp_path: Path, static_dir: Path) -> Settings:
    return Settings(db_path=tmp_path / "data" / "prelegal.db", static_dir=static_dir)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    # Entering the client runs the app's lifespan, which creates the database.
    with TestClient(create_app(settings)) as client:
        yield client
