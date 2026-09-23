# API contract

All request models forbid unknown fields. BOT values are decimal strings; JSON floating-point values are rejected.

## Evaluate a payment

POST /api/guard/evaluate

Example natural-language request:

    {
      "wallet": "0x1111111111111111111111111111111111111111",
      "prompt": "Send 0.01 BOT to Alice for the demo",
      "recipient_aliases": [
        {
          "name": "Alice",
          "address": "0x2222222222222222222222222222222222222222"
        }
      ]
    }

`recipient_aliases` is optional. It lets a user refer to a saved recipient by name rather
than typing an address. The API accepts exactly one matching recipient name, replaces it
with the associated address before extraction, and verifies that the extracted address is
the same one. The chain policy and contract still decide whether that address is allowed.

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

## Grounded AI assistant

POST /api/assistant/chat

The assistant runs on the private Qwen model configured for llama.cpp. The browser sends the
current question, up to eight recent conversation messages, and optional browser-local recipient
aliases. The API independently reloads the wallet balance, Safety Policy, recipient aggregates,
and recent contract events from BOT Testnet before asking Qwen to answer.

Wallet facts must come from that server-built live context. Contract events do not contain a
payment purpose or memo, so the assistant reports that limitation instead of inventing one.
Prompts and conversations are not persisted, and the assistant cannot sign or submit transactions.

Example request:

    {
      "wallet": "0x1111111111111111111111111111111111111111",
      "question": "Untuk apa pembayaran terakhir saya?",
      "conversation": [],
      "recipient_aliases": [
        {
          "name": "Alice",
          "address": "0x2222222222222222222222222222222222222222"
        }
      ]
    }

The response contains the natural-language answer, Qwen model name, live-data timestamp, and
the on-chain sources used for grounding.

## BOT Chain endpoints

| Method | Path | Result |
| --- | --- | --- |
| GET | /api/config | Public chain, contract, faucet, bundler, and gasless-capability configuration |
| POST | /api/botchain/simulate | Read-only executePayment simulation with gas, fee, balance-before, and balance-after preview |
| GET | /api/botchain/policy/{wallet} | Current contract policy and recipient list |
| GET | /api/botchain/transaction/{hash} | Pending, confirmed, or reverted receipt |
| GET | /api/botchain/history/{wallet} | AgentGuard PaymentExecuted receipts plus BOTScan-indexed incoming/outgoing native BOT transactions, totals, fees, status, and explorer links |
| GET | /api/botchain/readiness/{wallet} | BOT balance, chain, faucet, bundler, EntryPoint, and sponsorship readiness |
| GET | /api/health | Database, AI mode, and RPC status |

History and readiness contain public on-chain information only. Gasless capability remains
false in this release: the bundler check is informational until an AgentGuard paymaster is
deployed and funded and the client submits ERC-4337 UserOperations. The application never
silently labels a normal wallet transaction as sponsored.

Expected application errors use detail.code and detail.message. Schema errors remain FastAPI 422 responses.
