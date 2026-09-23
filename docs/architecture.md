# Architecture

    Next.js frontend (wallet + guarded payment workspace)
        |
        v
    FastAPI -> AI extractor -> Python guard -> BOT Chain RPC
        |                   |        ^
        |                   +------> BOT Chain ERC-4337 bundler capability check
        +------> SQLite audit        +--- AgentGuard contract + PaymentExecuted history

## Trust boundaries

1. Model output is parsed as untrusted data with extra fields forbidden.
2. Python applies chain, expiry, pause, recipient, transaction-limit, and daily-limit checks.
3. The frontend connects through an injected EVM provider or WalletConnect; mobile users can also enter through a MetaMask universal deep link. Private keys and transaction signatures always stay inside the selected wallet.
4. Payment-request links and QR codes are treated as untrusted input and pass through the same policy and simulation checks.
5. The contract repeats authoritative policy checks and records an anti-replay intent hash before transferring BOT.
6. The API stores only a prompt digest and sanitized decision fields; raw prompts and wallet secrets are not persisted.
7. Payment receipts are reconstructed from public contract events, while wallet History merges BOTScan-indexed normal and internal transactions for incoming/outgoing activity. Local recipient names and templates are never uploaded.
8. ERC-4337 sponsorship stays disabled until a project-owned paymaster is deployed and funded and the client submits UserOperations through the bundler.

## Integration contracts

- API schema: /api/openapi.json
- Human-readable API examples: docs/api.md
- Contract source of truth: blockchain/contracts/AgentGuard.sol
- Current frontend entry points: frontend/app/page.tsx, frontend/app/dashboard/page.tsx, and frontend/app/pay/page.tsx
- Chain configuration: testnet 968, mainnet 677

Any change to an endpoint, schema, contract function, event, environment variable, or chain value is an integration change and requires Project Lead review.
