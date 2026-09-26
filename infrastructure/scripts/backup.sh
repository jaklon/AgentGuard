#!/usr/bin/env sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
BACKUP_ROOT="$PROJECT_ROOT/backups"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TARGET="$BACKUP_ROOT/$STAMP"

mkdir -p "$TARGET"
chmod 700 "$BACKUP_ROOT" "$TARGET"

if [ -f "$PROJECT_ROOT/.env" ]; then
  install -m 600 "$PROJECT_ROOT/.env" "$TARGET/env"
fi
if command -v docker >/dev/null 2>&1 \
    && docker compose -f "$PROJECT_ROOT/docker-compose.yml" ps --status running --services 2>/dev/null \
        | grep -qx backend; then
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" cp \
    backend:/data/agentguard.db "$TARGET/agentguard.db"
  chmod 600 "$TARGET/agentguard.db"
elif [ -f "$PROJECT_ROOT/backend/data/agentguard.db" ]; then
  install -m 600 "$PROJECT_ROOT/backend/data/agentguard.db" "$TARGET/agentguard.db"
fi
install -m 600 "$PROJECT_ROOT/docker-compose.yml" "$TARGET/docker-compose.yml"
git -c safe.directory="$PROJECT_ROOT" -C "$PROJECT_ROOT" rev-parse HEAD >"$TARGET/commit.txt"

echo "Backup created at $TARGET"
