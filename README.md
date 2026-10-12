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

Sign up with an email and password, then draft any of the 11 Common Paper agreements listed in
`documents.json` (Mutual NDA, Cloud Service, SLA, Professional Services, Software License, DPA,
BAA, AI Addendum, Pilot, Design Partner, Partnership) by chatting with an AI assistant (an
OpenRouter model served by Cerebras, which needs `OPENROUTER_API_KEY` in `.env`). The assistant
finds the right agreement, or the closest one if Prelegal can't draft what you ask for, then fills in
the key terms. Documents are saved after every message and listed under "My documents".

The SQLite database is temporary: it is created from scratch whenever the app starts, so accounts
and documents are lost on restart. Documents are drafts and are subject to legal review.

Set `COOKIE_SECURE=1` when serving over HTTPS so the session cookie is only sent securely.

Repeated failed sign-ins for an email (5 in 15 minutes) and sign-ups from one address (10 per hour)
are rate limited; the counts are kept in the database, so all server processes share them. Signing
up with an email that already has an account doesn't reveal that: with the right password it signs
in, otherwise it fails like a wrong sign-in (and counts towards that email's limit). If a document is edited in two windows at once, the later message is rejected with
a prompt to reload rather than overwriting the other window's changes.

## How documents work

- `documents.json` describes each agreement: its template in `templates/`, the two parties and the key
  terms (the variables highlighted in the template). A backend test checks that every variable in
  every template is covered.
- The Mutual NDA has its own cover page template; the other agreements get a generated cover page
  listing the key terms, the parties and a signature block, followed by the verbatim Standard Terms.
- The backend owns the conversation: `POST /api/documents/{id}/chat` asks the model (Structured
  Outputs) for a reply and the changed terms, validates and merges them, and saves the document.

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
