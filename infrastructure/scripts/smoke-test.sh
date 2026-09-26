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
printf '%s\n' "$HEALTH" | grep -Eq '"botchain_rpc":\{"status":"ok"'

CONFIG=$(curl -fsS --max-time 10 "$BASE_URL/api/config")
printf '%s\n' "$CONFIG" | grep -Eq '"chain_id":677([,}])'
printf '%s\n' "$CONFIG" | grep -Fq '"chain_name":"BOT Chain Mainnet"'
printf '%s\n' "$CONFIG" | grep -Fq '"rpc_url":"https://rpc.botchain.ai"'
printf '%s\n' "$CONFIG" | grep -Fq '"explorer_url":"https://scan.botchain.ai"'
printf '%s\n' "$CONFIG" | grep -Fqi '"contract_address":"0xae49e0dFae28d43e149b09c4240CbA2F378A1dd6"'

echo "Mainnet smoke test passed for $BASE_URL"
