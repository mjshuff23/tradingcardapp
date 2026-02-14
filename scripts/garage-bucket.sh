#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

BUCKET_NAME="${1:-${S3_BUCKET:-trading-cards}}"
KEY_NAME="${2:-${BUCKET_NAME}-key}"

CONTAINER_ID=$(docker compose -f "$ROOT_DIR/docker-compose.yml" ps -q garage)
if [ -z "$CONTAINER_ID" ]; then
  echo "Garage container not running. Start it with: docker compose up -d garage"
  exit 1
fi

garage() {
  docker exec "$CONTAINER_ID" /garage -c /etc/garage.toml "$@"
}

strip_ansi() {
  sed -r 's/\x1b\[[0-9;]*m//g'
}

ensure_layout() {
  local output node_id current_version next_version

  output="$(garage status | strip_ansi)"
  node_id="$(echo "$output" | awk '/^[0-9a-f]{16}/ {print $1; exit}')"

  if [ -z "$node_id" ]; then
    echo "Unable to determine Garage node ID."
    exit 1
  fi

  if echo "$output" | grep -q "NO ROLE ASSIGNED"; then
    echo "Initializing Garage layout..."
    current_version="$(garage layout show | strip_ansi | awk '/Current cluster layout version:/ {print $NF}')"
    current_version="${current_version:-0}"
    next_version=$((current_version + 1))

    garage layout assign -z garage --capacity 10GB "$node_id"
    garage layout apply --version "$next_version"

    sleep 2
  fi
}

generate_key() {
  node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
}

generate_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
}

escape_sed() {
  printf '%s' "$1" | sed -e 's/[\\/&|]/\\&/g'
}

update_env_file() {
  local file="$1"
  local key="$2"
  local value="$3"
  local escaped

  if [ ! -f "$file" ]; then
    return
  fi

  escaped="$(escape_sed "$value")"

  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${escaped}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

ensure_layout

ACCESS_KEY="${S3_ACCESS_KEY:-}"
SECRET_KEY="${S3_SECRET_KEY:-}"

if [ -z "$ACCESS_KEY" ] || [ -z "$SECRET_KEY" ] || [ "$ACCESS_KEY" = "tradingcards" ] || [ "$SECRET_KEY" = "tradingcardssecret" ] || [ "$ACCESS_KEY" = "change-me" ] || [ "$SECRET_KEY" = "change-me" ]; then
  ACCESS_KEY="$(generate_key)"
  SECRET_KEY="$(generate_secret)"
fi

set +e

garage key import --yes -n "$KEY_NAME" "$ACCESS_KEY" "$SECRET_KEY"
IMPORT_KEY_STATUS=$?

garage bucket create "$BUCKET_NAME"
CREATE_BUCKET_STATUS=$?

set -e

if [ $IMPORT_KEY_STATUS -ne 0 ]; then
  echo "Key may already exist. Continuing..."
fi

if [ $CREATE_BUCKET_STATUS -ne 0 ]; then
  echo "Bucket may already exist. Continuing..."
fi

garage bucket allow --read --write --owner "$BUCKET_NAME" --key "$ACCESS_KEY"

update_env_file "$ROOT_DIR/.env" "S3_BUCKET" "$BUCKET_NAME"
update_env_file "$ROOT_DIR/.env" "S3_ACCESS_KEY" "$ACCESS_KEY"
update_env_file "$ROOT_DIR/.env" "S3_SECRET_KEY" "$SECRET_KEY"

update_env_file "$ROOT_DIR/apps/backend/.env" "S3_BUCKET" "$BUCKET_NAME"
update_env_file "$ROOT_DIR/apps/backend/.env" "S3_ACCESS_KEY" "$ACCESS_KEY"
update_env_file "$ROOT_DIR/apps/backend/.env" "S3_SECRET_KEY" "$SECRET_KEY"

update_env_file "$ROOT_DIR/apps/frontend/.env" "NEXT_PUBLIC_S3_BUCKET" "$BUCKET_NAME"

printf '\nBucket "%s" configured.\n' "$BUCKET_NAME"
printf 'Updated .env files with new S3 credentials.\n'
