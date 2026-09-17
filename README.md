# AgentGuard

AgentGuard is a human-in-the-loop safety checkpoint for BOT Chain payments. It turns a natural-language instruction into a strict payment intent, applies deterministic policy checks, asks the connected wallet for final approval, and leaves auditable on-chain evidence. The AI layer never signs transactions and never receives wallet secrets.

This repository implements the baseline from `AgentGuard_Implementation_Plan.docx` for the BOT Chain Build Week Hackathon Vol. 2.

## Repository map

| Path | Owner | Purpose |
| --- | --- | --- |
| `frontend/` | Rafly Alif | Next.js frontend-only product demo and local policy simulation |
| `backend/` | Syahrafi + Project Lead | FastAPI, SQLite, RPC adapter, rate limiting |
| `guard-engine/` | Project Lead | AI extraction adapter and deterministic policy engine |
| `blockchain/` | Project Lead | Solidity policy/payment contract, tests, deploy script |
| `infrastructure/` | Project Lead | Caddy, containers, backup and smoke-test scripts |
| `docs/` | All | API contract, architecture, demo, operations, backlog |

## Safety invariants

- No backend endpoint accepts a private key or seed phrase; any future wallet flow must keep signing in the user's wallet.
- AI output is untrusted and validated before deterministic rules run.
- The smart contract repeats transaction limit, daily limit, expiry, recipient, and pause checks.
- Prompts are not persisted. The audit table stores a SHA-256 digest and sanitized decision metadata.
- `NEXT_PUBLIC_*` values are public by definition and must never contain credentials.

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

The app opens at `http://localhost:5173`; the API is at `http://localhost:8000`. The current frontend is an explicitly local, frontend-only prototype: it does not connect a wallet, send funds, or call the API. The backend remains available for API and guard-engine integration testing.

### Frontend-only preview

For the local frontend-only demo prepared in this workspace, run from the repository root:

```bash
./start-frontend.sh
```

Keep that terminal open while using the preview. The script uses the workspace-local Node.js runtime and starts Next.js on port `5173`.

The frontend flow is available at:

- `/` — product introduction
- `/login` — simulated demo login
- `/dashboard` — the complete AgentGuard safety workspace

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

Copy the resulting address into `BOTCHAIN_CONTRACT_ADDRESS` for the API and run the smoke test. Never commit the deployment key or `.env` file.

## Production

Set `DOMAIN`, origins, contract address, and the server-side AI key in `/srv/agentguard/.env`, then:

```bash
docker compose config
docker compose up -d --build
docker compose ps
./infrastructure/scripts/smoke-test.sh "https://$DOMAIN"
```

See [operations](docs/operations.md), [API contract](docs/api.md), and the [release checklist](docs/release-checklist.md) before deploying. Mainnet is deliberately disabled as a default; the release gate must be passed first.
