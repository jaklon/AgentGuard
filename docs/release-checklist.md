# Release checklist

## Code and security

- [x] Guard, API, contract, frontend, and critical integration tests pass.
- [x] Gitleaks passes for Git history, current source, and the browser-delivered static bundle.
- [x] CORS contains only the production HTTPS origin.
- [x] Request limits, rate limits, sanitized logs, SQLite WAL, and health checks are active.
- [x] Contract security tests cover authorization, pause, allowlist, boundaries, replay, and reentrancy-sensitive transfers.

## Configuration

- [x] Backend and frontend use the same contract address, chain ID, RPC, and explorer.
- [ ] Contract address and at least one successful transaction are visible on BOTScan.
- [x] Mainnet release decision recorded on 26 September 2026; production is pinned to chain `677` and the approved contract.
- [x] DNS resolves to the VM and HTTPS has a valid certificate.

## Acceptance

- [ ] Clean browser connects and switches network.
- [ ] User reads or creates an on-chain policy.
- [ ] 0.01 BOT returns ALLOW and confirms on-chain.
- [ ] 0.05 BOT returns BLOCK and never opens MetaMask.
- [ ] Manual fallback works with the AI key removed.
- [ ] Complete flow succeeds three consecutive times.
- [ ] Services recover after a VM reboot.

## Evidence

- Release tag:
- Commit:
- Contract: `0xae49e0dFae28d43e149b09c4240CbA2F378A1dd6`
- ALLOW transaction:
- BLOCK screenshot:
- Live URL: `https://agentguard.my.id`
- Tester and time: Codex deployment verification, 26 September 2026 12:57 WIB
- Rollback tag:
