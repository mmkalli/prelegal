import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import init_db
from app.main import create_app


def columns(db_path: Path) -> list[str]:
    with sqlite3.connect(db_path) as conn:
        return [row[1] for row in conn.execute("PRAGMA table_info(users)")]


def test_init_db_creates_users_table(tmp_path: Path) -> None:
    db_path = tmp_path / "nested" / "prelegal.db"

    init_db(db_path)

    assert columns(db_path) == ["id", "email", "password_hash", "created_at"]


def test_init_db_creates_all_tables(tmp_path: Path) -> None:
    db_path = tmp_path / "prelegal.db"

    init_db(db_path)

    with sqlite3.connect(db_path) as conn:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert {"users", "sessions", "documents"} <= tables


def test_users_email_is_unique(tmp_path: Path) -> None:
    db_path = tmp_path / "prelegal.db"
    init_db(db_path)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("INSERT INTO users (email, password_hash) VALUES ('a@b.co', 'x')")
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO users (email, password_hash) VALUES ('A@B.co', 'y')")
    finally:
        conn.close()


def test_database_is_recreated_on_every_startup(settings: Settings) -> None:
    with TestClient(create_app(settings)):
        conn = sqlite3.connect(settings.db_path)
        conn.execute("INSERT INTO users (email, password_hash) VALUES ('a@b.co', 'x')")
        conn.commit()
        conn.close()

    with TestClient(create_app(settings)):
        conn = sqlite3.connect(settings.db_path)
        count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        conn.close()

    assert count == 0


def test_connections_work_across_threads(settings: Settings) -> None:
    """FastAPI may open a request's connection on one threadpool thread and use it on another."""
    from concurrent.futures import ThreadPoolExecutor
    from types import SimpleNamespace

    from app.db import get_conn

    init_db(settings.db_path)
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings=settings)))
    dependency = get_conn(request)
    conn = next(dependency)

    with ThreadPoolExecutor(max_workers=1) as other_thread:
        count = other_thread.submit(lambda: conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]).result()

    assert count == 0
    dependency.close()
