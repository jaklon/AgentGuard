#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$PROJECT_DIR/.tools/node/bin/node"
NPM_CLI="$PROJECT_DIR/.tools/node/lib/node_modules/npm/bin/npm-cli.js"

if [[ ! -x "$NODE_BIN" ]]; then
  echo "Node.js lokal belum tersedia di .tools/node."
  echo "Minta Codex menyiapkan runtime Node.js terlebih dahulu."
  exit 1
fi

cd "$PROJECT_DIR/frontend"
exec "$NODE_BIN" "$NPM_CLI" run dev
