#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
ENV_ARGS=""

if [ -f "$ROOT_DIR/.env.docker" ]; then
  ENV_ARGS="--env-file $ROOT_DIR/.env.docker"
fi

if [ "${1:-}" = "--build" ]; then
  docker compose $ENV_ARGS -f "$ROOT_DIR/docker-compose.dev.yml" build
fi

docker compose $ENV_ARGS -f "$ROOT_DIR/docker-compose.dev.yml" up -d

cat <<'EOF'

Docker Linux 开发环境已启动：
  前端：http://localhost:5173
  后端：http://localhost:3001/api/health
  MySQL：127.0.0.1:3307
  Redis：127.0.0.1:6380

查看日志：sh scripts/dev-docker-logs.sh
停止环境：sh scripts/dev-docker-down.sh
EOF
