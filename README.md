# AgentGuard

AgentGuard is a human-in-the-loop safety checkpoint for BOT Chain payments. It turns a natural-language instruction into a strict payment intent, applies deterministic policy checks, asks the connected wallet for final approval, and leaves auditable on-chain evidence. The AI layer never signs transactions and never receives wallet secrets.

This repository implements the baseline from `AgentGuard_Implementation_Plan.docx` for the BOT Chain Build Week Hackathon Vol. 2.

## Repository map

| Path | Owner | Purpose |
| --- | --- | --- |
| `frontend/` | Rafly Alif | React UI, MetaMask, preview, transaction state |
| `backend/` | Syahrafi + Project Lead | FastAPI, SQLite, RPC adapter, rate limiting |
| `guard-engine/` | Project Lead | AI extraction adapter and deterministic policy engine |
| `blockchain/` | Project Lead | Solidity policy/payment contract, tests, deploy script |
| `infrastructure/` | Project Lead | Caddy, containers, backup and smoke-test scripts |
| `docs/` | All | API contract, architecture, demo, operations, backlog |

## Safety invariants

- The browser signs through MetaMask; no backend endpoint accepts a private key or seed phrase.
- AI output is untrusted and validated before deterministic rules run.
- The smart contract repeats transaction limit, daily limit, expiry, recipient, and pause checks.
- Prompts are not persisted. The audit table stores a SHA-256 digest and sanitized decision metadata.
- `VITE_*` values are public by definition and must never contain credentials.

## Local setup

Requirements: Python 3.12, Node.js 24 LTS, npm, and optionally Docker Compose v2.

```bash
cp .env.example .env
make setup
make backend-dev
```

In a second terminal:

```bash
make frontend-dev
```

The app opens at `http://localhost:5173`; the API is at `http://localhost:8000`. With no `OPENAI_API_KEY`, the backend uses its deterministic/manual fallback so the safety flow remains demonstrable.

## Test and build

```bash
make test
make build
docker compose config
```

Contract deployment is intentionally separate from application deployment and requires a dedicated, low-value testnet key:

```bash
cd blockchain
cp .env.example .env
npm run deploy:testnet
```

Copy the resulting address into `BOTCHAIN_CONTRACT_ADDRESS` and `VITE_BOTCHAIN_CONTRACT_ADDRESS`, rebuild the frontend, and run the smoke test. Never commit the deployment key or `.env` file.

## Production

Set `DOMAIN`, origins, contract address, and the server-side AI key in `/srv/agentguard/.env`, then:

```bash
docker compose config
docker compose up -d --build
docker compose ps
./infrastructure/scripts/smoke-test.sh "https://$DOMAIN"
```

See [operations](docs/operations.md), [API contract](docs/api.md), and the [release checklist](docs/release-checklist.md) before deploying. Mainnet is deliberately disabled as a default; the release gate must be passed first.
