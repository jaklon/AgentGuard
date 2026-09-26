# Six-minute demo

The current Next.js frontend uses the live AgentGuard API and wallet integration. Use a dedicated low-value Mainnet wallet and never claim a transaction succeeded until BOTScan shows its confirmed receipt.

1. Open the public HTTPS site in a clean browser and name the safety invariant: AgentGuard never receives the wallet key.
2. Connect the dedicated low-value wallet and switch to BOT Chain Mainnet (chain `677`).
3. Show an on-chain policy with a 0.02 BOT per-transaction limit and the demo recipient allowed.
4. Submit a 0.01 BOT instruction. Point out the extracted fields, low risk score, contract simulation, complete recipient, contract address, and gas estimate.
5. Approve in MetaMask, wait for confirmation, and open the transaction on BOTScan.
6. Submit 0.05 BOT. Show the BLOCK decision and that MetaMask is never opened.
7. Switch to manual fallback and repeat a safe evaluation while the AI key is disabled.

Record the clean-browser run, contract address, transaction hash, date/time, tester, and release commit in the release checklist.
