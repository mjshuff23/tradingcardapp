#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$ROOT_DIR")}"
USER_ID="${LOCAL_UID:-$(id -u)}"
GROUP_ID="${LOCAL_GID:-$(id -g)}"

VOLUMES=(
  "${PROJECT_NAME}_backend_node_modules"
  "${PROJECT_NAME}_frontend_node_modules"
)

for volume in "${VOLUMES[@]}"; do
  if ! docker volume inspect "$volume" >/dev/null 2>&1; then
    echo "Skipping missing volume: $volume"
    continue
  fi

  echo "Fixing ownership in $volume -> ${USER_ID}:${GROUP_ID}"
  docker run --rm \
    --user 0:0 \
    -v "${volume}:/vol" \
    alpine:3.20 \
    sh -lc "chown -R ${USER_ID}:${GROUP_ID} /vol"
done

echo "Docker node_modules volume ownership repaired."
