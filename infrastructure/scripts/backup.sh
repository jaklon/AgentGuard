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
if [ -f "$PROJECT_ROOT/backend/data/agentguard.db" ]; then
  install -m 600 "$PROJECT_ROOT/backend/data/agentguard.db" "$TARGET/agentguard.db"
fi
install -m 600 "$PROJECT_ROOT/docker-compose.yml" "$TARGET/docker-compose.yml"
git -C "$PROJECT_ROOT" rev-parse HEAD >"$TARGET/commit.txt"

echo "Backup created at $TARGET"
