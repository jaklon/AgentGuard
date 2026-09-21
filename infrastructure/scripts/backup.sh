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
if docker compose -f "$PROJECT_ROOT/docker-compose.yml" ps --status running backend | grep -q backend; then
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T backend python -c "import sqlite3; src=sqlite3.connect('/data/agentguard.db'); dst=sqlite3.connect('/tmp/agentguard-backup.db'); src.backup(dst); dst.close(); src.close()"
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" cp backend:/tmp/agentguard-backup.db "$TARGET/agentguard.db"
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T backend rm -f /tmp/agentguard-backup.db
  chmod 600 "$TARGET/agentguard.db"
fi
install -m 600 "$PROJECT_ROOT/docker-compose.yml" "$TARGET/docker-compose.yml"
git -C "$PROJECT_ROOT" rev-parse HEAD >"$TARGET/commit.txt"

echo "Backup created at $TARGET"
