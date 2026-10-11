import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    """Runtime configuration, read from environment variables."""

    db_path: Path
    static_dir: Path

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            db_path=Path(os.environ.get("DB_PATH", "data/prelegal.db")),
            static_dir=Path(os.environ.get("STATIC_DIR", "static")),
        )
