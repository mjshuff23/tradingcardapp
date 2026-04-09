#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$ROOT_DIR")}"
BACKEND_VOLUME="${PROJECT_NAME}_backend_node_modules"
USER_ID="${LOCAL_UID:-$(id -u)}"
GROUP_ID="${LOCAL_GID:-$(id -g)}"

cd "$ROOT_DIR"

echo "Stopping and removing the backend service container if it exists..."
docker compose stop backend >/dev/null 2>&1 || true
docker compose rm -f backend >/dev/null 2>&1 || true

if docker volume inspect "$BACKEND_VOLUME" >/dev/null 2>&1; then
  echo "Removing stale backend dependency volume: $BACKEND_VOLUME"
  docker volume rm -f "$BACKEND_VOLUME" >/dev/null
else
  echo "Backend dependency volume not found: $BACKEND_VOLUME"
fi

echo "Rebuilding the backend image so Docker uses Node 22 and current dependencies..."
docker compose build backend

echo "Creating backend dependency volume..."
docker volume create "$BACKEND_VOLUME" >/dev/null

echo "Fixing backend dependency volume ownership to ${USER_ID}:${GROUP_ID}..."
docker run --rm \
  --user 0:0 \
  -v "${BACKEND_VOLUME}:/vol" \
  alpine:3.20 \
  sh -lc "chown -R ${USER_ID}:${GROUP_ID} /vol"

echo "Reinstalling backend workspace dependencies inside Docker..."
docker compose run --rm --no-deps backend npm install -w apps/backend

echo "Starting backend service with fresh dependencies..."
docker compose up -d backend

echo "Backend Docker dependencies refreshed."
