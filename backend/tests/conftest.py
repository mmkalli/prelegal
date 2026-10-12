from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.documents.spec import Registry, load_registry
from app.llm import LlmClient, ResponseModel
from app.main import create_app

REPO = Path(__file__).resolve().parents[2]
REGISTRY_PATH = REPO / "documents.json"
TEMPLATES_DIR = REPO / "templates"
PASSWORD = "correct horse battery"


@pytest.fixture(scope="session")
def registry() -> Registry:
    return load_registry(REGISTRY_PATH, TEMPLATES_DIR)


@pytest.fixture
def static_dir(tmp_path: Path) -> Path:
    """A minimal stand-in for the exported frontend (`next build` with trailingSlash)."""
    root = tmp_path / "static"
    for page, html in {
        "index.html": "<p>entry</p>",
        "login/index.html": "<p>login page</p>",
        "documents/index.html": "<p>documents page</p>",
        "documents/edit/index.html": "<p>editor page</p>",
        "404.html": "<p>page not found</p>",
        "_next/static/chunk.js": "console.log('chunk');",
    }.items():
        (root / page).parent.mkdir(parents=True, exist_ok=True)
        (root / page).write_text(html)
    return root


@pytest.fixture
def settings(tmp_path: Path, static_dir: Path) -> Settings:
    return Settings(
        db_path=tmp_path / "data" / "prelegal.db",
        static_dir=static_dir,
        registry_path=REGISTRY_PATH,
        templates_dir=TEMPLATES_DIR,
    )


class FakeLlm(LlmClient):
    """Returns scripted responses instead of calling the model, and records the requests.

    A scripted dict is validated into the requested response model; an exception is raised; a
    callable is called first (e.g. to change the database while the "model" is thinking).
    """

    def __init__(self) -> None:
        super().__init__(api_key="test-key")
        self.responses: list[dict[str, Any] | Exception | Callable[[], dict[str, Any]]] = []
        self.requests: list[list[dict[str, str]]] = []
        self.models: list[type] = []

    def complete(self, messages: list[dict[str, str]], response_model: type[ResponseModel]) -> ResponseModel:
        self.requests.append(messages)
        self.models.append(response_model)
        response = self.responses.pop(0)
        if callable(response):
            response = response()
        if isinstance(response, Exception):
            raise response
        return response_model.model_validate(response)


@pytest.fixture
def fake_llm() -> FakeLlm:
    return FakeLlm()


@pytest.fixture
def client(settings: Settings, fake_llm: FakeLlm) -> Iterator[TestClient]:
    # Entering the client runs the app's lifespan, which creates the database.
    with TestClient(create_app(settings, llm=fake_llm)) as client:
        yield client


def sign_up(client: TestClient, email: str = "ada@example.com") -> dict:
    response = client.post("/api/auth/signup", json={"email": email, "password": PASSWORD})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def user_client(client: TestClient) -> TestClient:
    """A client signed in as ada@example.com (the session cookie is kept by the client)."""
    sign_up(client)
    return client


def null_update(spec, **fields: Any) -> dict[str, Any]:
    """An `updates` payload for `spec` that changes only the given fields (and parties)."""
    parties = {party.key: None for party in spec.parties} | fields.pop("parties", {})
    return {field.key: None for field in spec.fields} | fields | {"parties": parties}


def party(**fields: str) -> dict[str, str | None]:
    return {"name": None, "title": None, "company": None, "noticeAddress": None} | fields
