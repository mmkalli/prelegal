#!/usr/bin/env bash
# Stops Prelegal and removes its container (and with it the temporary database).
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose down
echo "Prelegal stopped."
