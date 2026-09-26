# AgentGuard

**A human-controlled safety checkpoint for AI-agent payments on BOT Chain.**

AgentGuard converts a natural-language payment request into a structured intent, checks it against deterministic safety rules and the wallet's live on-chain policy, previews the transaction, and only then asks the user's wallet for approval. The AI can explain and propose; it cannot sign or move funds.

> Current application status: live on **BOT Chain Mainnet (Chain ID 677)**. The production release uses the verified AgentGuard contract below; wallet signatures remain entirely user-controlled.

## Live deployment

| Resource | Link / value |
| --- | --- |
| Production domain | [https://agentguard.my.id](https://agentguard.my.id) |
| API health | [agentguard.my.id/api/health](https://agentguard.my.id/api/health) |
| API documentation | [agentguard.my.id/api/docs](https://agentguard.my.id/api/docs) |
| Network | BOT Chain Mainnet · Chain ID `677` |
| AgentGuard contract | [`0xae49e0dFae28d43e149b09c4240CbA2F378A1dd6`](https://scan.botchain.ai/address/0xae49e0dFae28d43e149b09c4240CbA2F378A1dd6) |
| Mainnet explorer | [scan.botchain.ai](https://scan.botchain.ai) |

Last verified on 26 September 2026: production health was `ok`, public configuration reported chain `677` and the approved contract, and all containers were healthy. The read-only contract check confirmed matching executable runtime bytecode, owner `0x1905…1a91`, and an unpaused global state.

## Why AgentGuard exists

AI agents can prepare transactions quickly, but speed should not remove human control. AgentGuard places a clear checkpoint between an AI instruction and a blockchain payment:

1. **Describe** — enter a payment request in plain English or open a shared payment link/QR.
2. **Extract** — identify the action, recipient, amount, network, and purpose.
3. **Check** — deterministic rules and a contract simulation verify limits, daily usage, expiry, pause state, allowlist, balance, and gas.
4. **Review** — show the decision, risk score, reasons, recipient, amount, and estimated balance impact.
5. **Approve** — ask the selected wallet for the final signature. AgentGuard never receives the private key.
6. **Track** — follow confirmation and link the receipt to BOTScan.

## Current features

### Guarded payments

- Natural-language payment extraction through a private local Qwen model.
- Deterministic extraction fallback when the AI service is unavailable.
- `ALLOW`, `WARN`, and `BLOCK` decisions with risk scores and readable reasons.
- Read-only contract simulation before opening the wallet.
- Gas, fee, wallet balance, and balance-after-payment previews.
- Explicit wallet approval with pending, confirmed, and reverted states.
- Recovery guidance for network, balance, signature, RPC, and policy problems.

### Wallet and payment access

- Injected EVM wallets, WalletConnect QR, and MetaMask Mobile deep links.
- Automatic BOT Chain Mainnet network switching/addition.
- Pay-by-link and QR requests with recipient, amount, display name, and purpose.
- Browser-local recipient names and reusable payment templates.

### On-chain safety policy

- Per-transaction and daily spending limits.
- Live daily usage, recipient allowlist, policy expiry, and wallet pause.
- Owner-controlled global emergency pause.
- One-time intent hashes to prevent replay.
- Native BOT payment execution and optional contract deposits at the Solidity layer.

### History and assistance

- AgentGuard `PaymentExecuted` receipt history.
- BOTScan-indexed incoming, outgoing, failed, and internal wallet activity.
- Address labels, receipt sharing, explorer links, and CSV export.
- Private AI assistant grounded in fresh balance, policy, recipient totals, and contract events.
- Safe live-data fallback when conversational AI is unavailable.

### Workspace views

| View | What it provides |
| --- | --- |
| Check Payment | Turns a payment instruction into a reviewed `ALLOW`, `WARN`, or `BLOCK` decision before signing. |
| Pay by Link | Creates and opens shareable payment requests using links or QR codes. |
| History | Shows contract receipts and wallet activity with labels, sharing, explorer links, and CSV export. |
| AI Assistant | Answers questions using current wallet balance, safety policy, recipients, and transaction events. |
| Safety Policy | Manages transaction limits, daily limits, trusted recipients, expiry, and pause controls. |
| Risk Breakdown | Explains the risk score, extracted intent, and every policy check behind a decision. |
| Transaction Status | Tracks approval, broadcast, confirmation, failure, and the final explorer receipt. |
| Help and Diagnostics | Provides onboarding, network guidance, service health, and recovery steps. |

### Product and operations

- Responsive introduction, operator entry, onboarding guide, and mobile navigation.
- English-only product interface.
- FastAPI request-size limits, rate limiting, strict schemas, and restricted CORS.
- SQLite audit records with prompt hashes instead of raw prompts.
- Nonce-based Content Security Policy and restrictive browser permissions.
- Docker Compose deployment with Caddy HTTPS, health checks, backups, and smoke tests.
- CI for Python tests, Solidity tests, frontend builds, and secret scanning.

## Feature status

| Area | Status | Notes |
| --- | --- | --- |
| Mainnet payment flow | ✅ Available | Real wallet signatures and BOT Chain Mainnet contract calls |
| Safety policy management | ✅ Available | Limits, allowlist, expiry, and pause are written on-chain |
| Payment links and QR | ✅ Available | Shared data is re-checked before approval |
| Wallet and AgentGuard history | ✅ Available | Contract events plus BOTScan indexing |
| Grounded AI assistant | ✅ Available | Private inference with verified live context |
| Deterministic fallback | ✅ Available | Guard evaluation continues if AI extraction fails |
| Mainnet contract | ✅ Released | Runtime bytecode matches the local artifact; owner and pause state pass the read-only deployment check |
| Explorer source verification | ✅ Mainnet verified | AgentGuard source is verified on BOTScan Mainnet |
| Gasless ERC-4337 payments | ⚠️ Capability check only | No funded paymaster or UserOperation submission path |
| ERC-20 payments | ❌ Not implemented | Current contract transfers native BOT only |
| Frontend automated tests | ⚠️ Partial | Wallet-signing safety regression tests exist; component and browser suites are still pending |
| Independent contract audit | ⚠️ Not completed | Mainnet users should use dedicated low-value wallets until an independent audit is complete |

## Architecture

```text
Browser / selected wallet
        |
        v
Next.js 16 + React 19 frontend
        |
        v
FastAPI API ---------------> SQLite audit records
        |
        +----> local Qwen extraction / assistant
        +----> deterministic Python policy engine
        +----> BOT Chain RPC and BOTScan
                        |
                        v
                 AgentGuard.sol
```

Trust is intentionally split across layers:

- Model output is treated as untrusted structured input.
- Python independently applies deterministic policy checks.
- The frontend performs a read-only contract simulation before approval.
- Solidity repeats the authoritative checks before transferring BOT.
- Transaction signing always remains inside the user's selected wallet.

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion 13, GSAP, Anime.js |
| Wallet | ethers 6, injected EVM providers, WalletConnect / Reown |
| API | Python 3.12, FastAPI, Pydantic, SQLAlchemy, SQLite |
| AI and guard | llama.cpp, Qwen3 4B, provider-agnostic extraction, deterministic Python policy engine |
| Contract | Solidity 0.8.24, OpenZeppelin 5.4, Hardhat 3.18 |
| Infrastructure | Docker Compose, Caddy, GitHub Actions |

## Repository map

| Path | Purpose |
| --- | --- |
| `frontend/` | Product site, wallet workspace, payment requests, history, assistant, and recovery UI |
| `backend/` | FastAPI endpoints, SQLite audit records, BOT Chain RPC and explorer adapter |
| `guard-engine/` | Extraction adapters, strict models, deterministic policy evaluation, assistant adapter |
| `blockchain/` | Solidity contract, Hardhat tests, and gated deployment scripts |
| `infrastructure/` | Caddy, deployment, backup, model-download, and smoke-test scripts |
| `docs/` | API, architecture, operations, demo, backlog, and release documentation |

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Product introduction and BOT Chain links |
| `/login` | Browser-local operator entry; not an account or custody system |
| `/dashboard` | Guarded payments, policy, history, assistant, and diagnostics |
| `/pay?...` | Shared payment request that is re-evaluated before approval |
| `/api/docs` | Interactive FastAPI documentation |

## Security invariants

- No endpoint accepts a private key, seed phrase, or wallet signature.
- Raw payment prompts and assistant conversations are not persisted.
- AI output must pass strict schema validation and deterministic checks.
- Payment links cannot approve, sign, or move funds.
- Browser-local recipient names and templates are not uploaded.
- Contract intent hashes are single-use per payer.
- Gasless status remains `false` until a project-owned paymaster and real UserOperation path exist.
- `NEXT_PUBLIC_*` values are public and must never contain secrets.

## Local development

Requirements: Python 3.12, Node.js 24 LTS with npm, and Docker Compose v2 for the complete stack.

```bash
cp .env.example .env
make setup
make backend-dev
```

In another terminal:

```bash
make frontend-dev
```

Open `http://localhost:5173`; the API runs at `http://localhost:8000`. The guard can use deterministic fallback without the local model. The conversational assistant requires the configured llama.cpp/Qwen service.

## Tests and build

```bash
make test
make build
docker compose config
```

CI currently runs:

- Guard-engine and backend Pytest suites.
- Hardhat 3 smart-contract tests, TypeScript checks, and coverage.
- Next.js production build and TypeScript validation.
- Wallet-signing safety tests using mocked EIP-1193 providers.
- Gitleaks secret scanning.

Frontend component and end-to-end browser tests are not configured yet.

## Contract deployment

Use a dedicated low-value deployment wallet. Never commit `.env` or a private key.

```bash
cd blockchain
cp .env.example .env
npm run deploy:testnet
```

Copy the resulting address to `BOTCHAIN_CONTRACT_ADDRESS`, rebuild, run the smoke test, and verify the source on the explorer.
Run the read-only deployment check with the real address supplied only through the ignored environment file:

```bash
AGENTGUARD_CONTRACT_ADDRESS=... npm run check:testnet
```


For the approved Mainnet deployment, use the read-only release check (it does not require a private key):

```bash
AGENTGUARD_CONTRACT_ADDRESS=0xae49e0dFae28d43e149b09c4240CbA2F378A1dd6 \
CONTRACT_OWNER_ADDRESS=0x1905B29C6F01eDe290010DB081A6ad0Ba78A1a91 \
npm run check:mainnet
```

Deployment records and keys must stay outside tracked files. A future Mainnet deployment remains gated by `ALLOW_MAINNET_DEPLOYMENT=true` and must use a dedicated low-value deployment wallet.

## Production deployment

Set the production domain, exact HTTPS origin, contract address, and WalletConnect Project ID in `/srv/agentguard/.env`. Keep the local model file in `/srv/agentguard/models/` and out of Git.

```bash
docker compose config
docker compose up -d --build
docker compose ps
./infrastructure/scripts/smoke-test.sh "https://$DOMAIN"
```

See [operations](docs/operations.md), [API contract](docs/api.md), [architecture](docs/architecture.md), and the [release checklist](docs/release-checklist.md).

## Remaining work

These are the main post-release hardening gaps:

1. **Complete an independent smart-contract security review.** The automated suite covers daily rollover, allowlist capacity/removal, failed recipients, and adversarial receiver contracts at 100% line and statement coverage; this does not replace an independent audit.
2. **Capture a signed Mainnet acceptance transaction.** Record one low-value ALLOW receipt and one BLOCK screenshot using a dedicated wallet.
3. **Expand frontend automated tests.** Add component and Playwright coverage for desktop, mobile, payment links, recovery states, and wallet-provider events.
4. **Create end-to-end release evidence.** Record three clean-browser flows, ALLOW transaction, BLOCK screenshot, reboot recovery, release tag, rollback tag, and signed checklist.
5. **Finish or remove incomplete roadmap claims.** ERC-4337 sponsorship, ERC-20 payments, operational audit export/UI, and durable payment-purpose metadata remain incomplete.
6. **Improve production observability.** Add error monitoring, uptime alerts, RPC/explorer degradation alerts, and backup-restore drills.

## Important limitations

- AgentGuard currently targets BOT Chain Mainnet and native BOT payments. Use a dedicated low-value wallet until the independent contract audit is complete.
- `/login` is a lightweight local entry experience, not user authentication.
- Payment purposes are not stored in contract events and cannot be reconstructed reliably.
- Wallet history depends partly on BOTScan indexing and may be temporarily incomplete.
- AgentGuard reduces transaction risk but cannot guarantee that a recipient, instruction, or external application is trustworthy.

## Team

| Member | Institution | Role | Responsibilities |
| --- | --- | --- | --- |
| Jascon Johanest Kembuan | Jakarta State Polytechnic | Project Lead · Blockchain & Infrastructure | Product coordination, deterministic Guard Engine, Solidity smart contract, deployment, Docker/Caddy infrastructure, release readiness, and security decisions. |
| Syah Rafi Elyusufi Abighaly | Jakarta State Polytechnic | Backend Engineer | FastAPI services, SQLite audit data, validation schemas, rate limiting, BOT Chain RPC and explorer integration, and API testing. |
| Raflyalif Adzani Pahlevi | Jakarta State Polytechnic | Frontend Engineer · UI/UX | Next.js and React interface, visual identity, responsive experience, wallet connection flow, payment interactions, and motion design. |

Portions of the wallet integration are © 2025 Reown, Inc. See the bundled [Reown Community License](frontend/public/legal/reown-community-license.txt).
