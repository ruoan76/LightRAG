#!/usr/bin/env bash
# OrbStack (or any Docker): watch repo changes, rebuild image, restart lightrag container.
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker compose \
  -f docker-compose.yml \
  -f docker-compose.host-ollama.yml \
  -f docker-compose.watch.yml \
  watch "$@"
