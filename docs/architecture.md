# Architecture

    Browser + MetaMask
        | strict request                         | explicit wallet approval
        v                                        v
    React frontend ----------------------> AgentGuard contract
        |                                        |
        v                                        v
    FastAPI -> AI extractor -> Python guard   BOT Chain
        |                            ^
        +------> SQLite audit        +--- read-only RPC

## Trust boundaries

1. Model output is parsed as untrusted data with extra fields forbidden.
2. Python applies chain, expiry, pause, recipient, transaction-limit, and daily-limit checks.
3. The frontend reveals the full address, amount, network, contract, purpose, and simulation result before calling MetaMask.
4. MetaMask owns the key and signature boundary.
5. The contract repeats authoritative policy checks and records an anti-replay intent hash before transferring BOT.
6. The API stores only a prompt digest and sanitized decision fields; raw prompts and wallet secrets are not persisted.

## Integration contracts

- API schema: /api/openapi.json
- Human-readable API examples: docs/api.md
- Contract source of truth: blockchain/contracts/AgentGuard.sol
- Browser ABI subset: frontend/src/contract.ts
- Chain configuration: testnet 968, mainnet 677

Any change to an endpoint, schema, contract function, event, environment variable, or chain value is an integration change and requires Project Lead review.
