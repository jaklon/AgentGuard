#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$PROJECT_DIR/.tools/node/bin/node"
NPM_CLI="$PROJECT_DIR/.tools/node/lib/node_modules/npm/bin/npm-cli.js"

if [[ ! -x "$NODE_BIN" ]]; then
  echo "A local Node.js installation is not available in .tools/node."
  echo "Ask Codex to set up the Node.js runtime first."
  exit 1
fi

cd "$PROJECT_DIR/frontend"
export PATH="$(dirname "$NODE_BIN"):$PATH"
exec "$NODE_BIN" "$NPM_CLI" run dev
