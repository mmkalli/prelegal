# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation supports all 11 document types via AI chat with full user authentication and document persistence.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools
5. Append a short, concise entry to the "Implementation Log" at the end of this file describing what was built

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `nvidia/nemotron-3-ultra-550b-a55b:free` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation Log

- **PL-2** - Added the Common Paper legal templates in `templates/` and `catalog.json`.
- **PL-3** - Mutual NDA creator prototype in Next.js: a form with a live preview and a downloadable PDF.
- **PL-4** - V1 technical foundation. The FastAPI backend (`backend/`) serves the static Next.js export and the API at :8000. A SQLite database is created from scratch on every start (`users` table). Fake login: `/login/` goes to `/app/`, with any credentials accepted and the session kept in sessionStorage. Dockerfile (with a pytest `test` target), docker-compose, and start/stop scripts in `scripts/`. `npm run dev` proxies `/api` to the backend. (PR #6)
- **PL-5** - AI chat for the Mutual NDA. The chat replaces the form on the left and the live preview stays on the right. `POST /api/chat` is stateless (it takes the recent messages and current values, and returns the reply and merged values) and uses LiteLLM through OpenRouter and Cerebras with Structured Outputs. The model returns a partial update that the backend validates and merges (`backend/app/nda.py`). Replies are in the user's language and fields are filled in English. Note: the LiteLLM model name needs the `openrouter/` prefix.
- **PL-6 + PL-7** - All 11 Common Paper agreements, real accounts, saved documents and a SaaS-style UI. `documents.json` (repo root) describes each agreement: parties and key terms (the template variables, all covered by a backend test). The Mutual NDA keeps its own cover page; the other agreements get a generated one (`frontend/lib/coverPage.ts`) plus their verbatim Standard Terms. Chat: `POST /api/chat/select` finds the agreement (or offers the closest supported one), then `POST /api/documents/{id}/chat` fills it in and saves it (the server owns the conversation). Auth: scrypt password hashes, sessions in SQLite, HttpOnly cookie (`backend/app/auth.py`). Pages: `/login/`, `/signup/`, `/documents/`, `/documents/new/`, `/documents/edit/?id=`. A draft disclaimer appears in the app footer, the editor and on every PDF page. Sign-in/sign-up are rate limited in memory (`backend/app/ratelimit.py`); documents carry a `version` so concurrent saves return 409; 422 responses never echo the rejected input. Gotcha: request-scoped sqlite connections need `check_same_thread=False`, because FastAPI runs dependencies on different threads.
