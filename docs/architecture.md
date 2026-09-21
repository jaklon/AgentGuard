# Architecture

    Next.js frontend (local product demo)
        |
        v
    FastAPI -> AI extractor -> Python guard -> BOT Chain RPC
        |                            ^
        +------> SQLite audit        +--- AgentGuard contract

## Trust boundaries

1. Model output is parsed as untrusted data with extra fields forbidden.
2. Python applies chain, expiry, pause, recipient, transaction-limit, and daily-limit checks.
3. The frontend uses an injected EVM wallet for account access and transaction signing; it never receives wallet secrets.
4. Any production wallet integration must retain MetaMask as the key and signature boundary.
5. The contract repeats authoritative policy checks and records an anti-replay intent hash before transferring BOT.
6. The API stores only a prompt digest and sanitized decision fields; raw prompts and wallet secrets are not persisted.

## Integration contracts

- API schema: /api/openapi.json
- Human-readable API examples: docs/api.md
- Contract source of truth: blockchain/contracts/AgentGuard.sol
- Current frontend entry points: frontend/app/page.tsx and frontend/app/login/page.tsx
- Chain configuration: testnet 968, mainnet 677

Any change to an endpoint, schema, contract function, event, environment variable, or chain value is an integration change and requires Project Lead review.
