# API contract

All request models forbid unknown fields. BOT values are decimal strings; JSON floating-point values are rejected.

## Evaluate a payment

POST /api/guard/evaluate

Example natural-language request:

    {
      "prompt": "Send 0.01 BOT to 0x2222222222222222222222222222222222222222 for the demo",
      "policy": {
        "wallet": "0x1111111111111111111111111111111111111111",
        "chain_id": 968,
        "per_transaction_limit_bot": "0.02",
        "daily_limit_bot": "0.10",
        "spent_today_bot": "0",
        "expires_at": "2026-10-01T00:00:00Z",
        "allowlist_enforced": true,
        "allowed_recipients": ["0x2222222222222222222222222222222222222222"],
        "paused": false
      }
    }

Manual fallback replaces prompt with a manual_intent object containing action, recipient, amount_bot, chain_id, and purpose.

Example response:

    {
      "decision": "ALLOW",
      "risk_score": 20,
      "reason": "Payment satisfies the deterministic wallet policy",
      "intent": {
        "action": "payment",
        "recipient": "0x2222222222222222222222222222222222222222",
        "amount_bot": "0.01",
        "chain_id": 968,
        "purpose": "the demo"
      },
      "warnings": [],
      "source": "openai",
      "transaction_hash": null,
      "evaluated_at": "2026-09-14T00:00:00Z"
    }

## BOT Chain endpoints

| Method | Path | Result |
| --- | --- | --- |
| POST | /api/botchain/simulate | Read-only eth_estimateGas of executePayment |
| GET | /api/botchain/policy/{wallet} | Current contract policy and recipient list |
| GET | /api/botchain/transaction/{hash} | Pending, confirmed, or reverted receipt |
| GET | /api/health | Database, AI mode, and RPC status |

Expected application errors use detail.code and detail.message. Schema errors remain FastAPI 422 responses.
