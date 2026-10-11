#!/usr/bin/env bash
# Builds and starts Prelegal in Docker at http://localhost:8000.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Warning: no .env file found; copy .env.example to .env and add your keys." >&2
fi

docker compose up --build --detach
echo "Prelegal is running at http://localhost:8000"
