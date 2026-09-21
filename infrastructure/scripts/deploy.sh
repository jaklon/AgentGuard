#!/usr/bin/env sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)

if [ "$PROJECT_ROOT" != "/srv/agentguard" ]; then
  echo "Refusing deployment outside /srv/agentguard"
  exit 1
fi
if [ -n "$(git -C "$PROJECT_ROOT" status --porcelain)" ]; then
  echo "Refusing deployment from a dirty checkout"
  exit 1
fi

"$PROJECT_ROOT/infrastructure/scripts/backup.sh"
git -C "$PROJECT_ROOT" switch main
git -C "$PROJECT_ROOT" pull --ff-only origin main
docker compose -f "$PROJECT_ROOT/docker-compose.yml" config --quiet
docker compose -f "$PROJECT_ROOT/docker-compose.yml" up -d --build
docker compose -f "$PROJECT_ROOT/docker-compose.yml" ps
