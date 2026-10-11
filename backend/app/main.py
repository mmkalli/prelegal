import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from app.config import Settings
from app.db import init_db
from app.routers import auth, health

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        init_db(settings.db_path)
        yield

    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.state.settings = settings

    app.include_router(auth.router)
    app.include_router(health.router)

    # Unknown /api paths get a JSON 404 rather than the frontend's 404 page.
    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    def api_not_found(path: str) -> None:
        raise HTTPException(status_code=404, detail="Not Found")

    # The statically exported Next.js frontend. Mounted last so the API routes take precedence;
    # `html=True` serves each route's index.html and the exported 404.html for unknown pages.
    if settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")
    else:
        logger.warning("Static directory %s not found; serving the API only", settings.static_dir)

    return app
