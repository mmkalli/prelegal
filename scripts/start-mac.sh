#!/usr/bin/env bash
# macOS uses the same Docker commands as Linux.
exec "$(dirname "$0")/start-linux.sh" "$@"
