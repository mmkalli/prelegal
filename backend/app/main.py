import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import Settings
from app.db import init_db
from app.documents.spec import load_registry
from app.llm import LlmClient
from app.ratelimit import login_limiter, signup_limiter
from app.routers import auth, catalog, chat, documents, health

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None, llm: LlmClient | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        init_db(settings.db_path)
        yield

    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.state.settings = settings
    app.state.llm = llm or LlmClient(settings.openrouter_api_key)
    app.state.registry = load_registry(settings.registry_path, settings.templates_dir)
    app.state.login_limiter = login_limiter()
    app.state.signup_limiter = signup_limiter()

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
        # Like FastAPI's default, but without echoing the rejected input: it may be a password,
        # or text that can't even be encoded in the response.
        details = [{k: v for k, v in e.items() if k not in ("input", "ctx")} for e in error.errors()]
        return JSONResponse(status_code=422, content={"detail": jsonable_encoder(details)})

    app.include_router(auth.router)
    app.include_router(health.router)
    app.include_router(chat.router)
    app.include_router(catalog.router)
    app.include_router(documents.router)

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
