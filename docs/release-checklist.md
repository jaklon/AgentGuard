# Release checklist

## Code and security

- [ ] Guard, API, contract, frontend, and critical integration tests pass.
- [ ] Secret scan passes and frontend bundle contains no key or credential.
- [ ] CORS contains only the production HTTPS origin.
- [ ] Request limits, rate limits, sanitized logs, SQLite WAL, and health checks are active.
- [ ] Contract security tests cover authorization, pause, allowlist, boundaries, replay, and reentrancy-sensitive transfers.

## Configuration

- [ ] Backend and frontend use the same contract address, chain ID, RPC, and explorer.
- [ ] Contract address and at least one successful transaction are visible on BOTScan.
- [ ] Mainnet remains disabled unless the team records a separate release decision.
- [ ] DNS resolves to the VM and HTTPS has a valid certificate.

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
- Contract:
- ALLOW transaction:
- BLOCK screenshot:
- Live URL:
- Tester and time:
- Rollback tag:
