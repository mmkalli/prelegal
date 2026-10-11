# prelegal
a platform for drafting common legal agreements

## Status

🚧 This project is currently in progress. It is expected to be completed within 1 week (by October 18, 2026).

## Running

Prelegal runs as a single Docker container: a FastAPI backend (`backend/`) that serves the API and
the statically exported Next.js frontend (`frontend/`) at http://localhost:8000.

```bash
cp .env.example .env          # then add your OPENROUTER_API_KEY

scripts/start-mac.sh          # or scripts/start-linux.sh / scripts/start-windows.ps1
scripts/stop-mac.sh           # or scripts/stop-linux.sh  / scripts/stop-windows.ps1
```

The SQLite database is temporary: it is created from scratch whenever the app starts.

Sign in currently accepts any email and password (there is no authentication yet). The Mutual NDA
is drafted by chatting with an AI assistant (an OpenRouter model served by Cerebras), which needs
`OPENROUTER_API_KEY` in `.env`.

## Development

- Frontend: see [frontend/README.md](frontend/README.md). `npm run dev` proxies `/api` to the
  backend at http://localhost:8000 (override with `BACKEND_URL`).
- Backend tests (no local Python needed):

  ```bash
  docker build --target test -t prelegal-test . && docker run --rm prelegal-test
  ```

  Add `--env-file .env` to `docker run` to also run the live test against the real model
  (`pytest -m live`).

  With [uv](https://docs.astral.sh/uv/) installed: `cd backend && uv run pytest`, and
  `uv run uvicorn app.main:create_app --factory --reload` to run the API locally.
