#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_ID="$(id -u)"
GROUP_ID="$(id -g)"

TARGETS=(
  "apps/frontend/.next"
  "apps/backend/dist"
  "apps/backend/tsconfig.build.tsbuildinfo"
)

try_local_clean() {
  rm -rf "$ROOT_DIR/apps/frontend/.next" "$ROOT_DIR/apps/backend/dist" "$ROOT_DIR/apps/backend/tsconfig.build.tsbuildinfo" 2>/dev/null || true
}

all_removed=1
for target in "${TARGETS[@]}"; do
  if [ -e "$ROOT_DIR/$target" ]; then
    all_removed=0
    break
  fi
done

if [ "$all_removed" -eq 1 ]; then
  echo "No stale dev caches found."
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  docker run --rm \
    --user 0:0 \
    -v "$ROOT_DIR:/workspace" \
    alpine:3.20 \
    sh -lc "
      for p in apps/frontend/.next apps/backend/dist apps/backend/tsconfig.build.tsbuildinfo; do
        if [ -e /workspace/\$p ]; then
          chown -R $USER_ID:$GROUP_ID /workspace/\$p || true
          rm -rf /workspace/\$p || true
        fi
      done
    "
  echo "Fixed ownership and cleared dev caches."
else
  try_local_clean
  for target in "${TARGETS[@]}"; do
    if [ -e "$ROOT_DIR/$target" ]; then
      echo "Unable to clean $target without docker. Use sudo chown or install docker."
      exit 1
    fi
  done
  echo "Cleared dev caches."
fi
