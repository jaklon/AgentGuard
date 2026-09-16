#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 https://agentguard.example"
  exit 2
fi

BASE_URL=$1

curl -fsS --max-time 10 "$BASE_URL/" >/dev/null
HEALTH=$(curl -fsS --max-time 10 "$BASE_URL/api/health")
printf '%s\n' "$HEALTH" | grep -Eq '"status":"(ok|degraded)"'

echo "Smoke test passed for $BASE_URL"
