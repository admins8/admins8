#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
ENV_ARGS=""

if [ -f "$ROOT_DIR/.env.docker" ]; then
  ENV_ARGS="--env-file $ROOT_DIR/.env.docker"
fi

if [ "${1:-}" = "--volumes" ]; then
  docker compose $ENV_ARGS -f "$ROOT_DIR/docker-compose.dev.yml" down --volumes
else
  docker compose $ENV_ARGS -f "$ROOT_DIR/docker-compose.dev.yml" down
fi
