import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    """Runtime configuration, read from environment variables."""

    db_path: Path
    static_dir: Path
    registry_path: Path
    templates_dir: Path
    openrouter_api_key: str | None = None
    # Set COOKIE_SECURE=1 when served over HTTPS; off by default for http://localhost.
    cookie_secure: bool = False

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            db_path=Path(os.environ.get("DB_PATH", "data/prelegal.db")),
            static_dir=Path(os.environ.get("STATIC_DIR", "static")),
            registry_path=Path(os.environ.get("REGISTRY_PATH", "../documents.json")),
            templates_dir=Path(os.environ.get("TEMPLATES_DIR", "../templates")),
            openrouter_api_key=os.environ.get("OPENROUTER_API_KEY") or None,
            cookie_secure=os.environ.get("COOKIE_SECURE", "").lower() in ("1", "true", "yes"),
        )
