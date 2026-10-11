# syntax=docker/dockerfile:1

# --- Frontend: static export of the Next.js app -------------------------------------------------
FROM node:24-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
# Templates are read at build time from ../templates (see frontend/lib/templates.ts).
COPY templates/ /build/templates/
COPY frontend/ ./
ENV NEXT_OUTPUT=export NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Backend dependencies -----------------------------------------------------------------------
FROM python:3.13-slim AS backend
COPY --from=ghcr.io/astral-sh/uv:0.9.30 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH=/opt/venv/bin:$PATH
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

# --- Backend tests: docker build --target test -t prelegal-test . && docker run --rm prelegal-test
FROM backend AS test
RUN uv sync --frozen
COPY backend/ ./
CMD ["pytest", "-q"]

# --- Runtime: FastAPI serving the API and the exported frontend ----------------------------------
FROM backend AS runtime
COPY backend/app ./app
COPY --from=frontend /build/frontend/out ./static
RUN useradd --system --no-create-home prelegal && mkdir data && chown prelegal data
USER prelegal
# The SQLite database is temporary: the app recreates it on every startup.
ENV DB_PATH=/app/data/prelegal.db STATIC_DIR=/app/static
EXPOSE 8000
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
