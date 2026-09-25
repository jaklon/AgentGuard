export const MAINNET_CONTRACT_URL = "https://scan.botchain.ai/address/0xae49e0dFae28d43e149b09c4240CbA2F378A1dd6";

export function MainnetExplorerLink() {
  return (
    <a className="mainnet-explorer-button" href={MAINNET_CONTRACT_URL}
      target="_blank" rel="noopener noreferrer"
      aria-label="View AgentGuard mainnet contract on BOT Chain Explorer (opens in a new tab)">
      <img src="/brand/bot-chain.svg" width="76" height="32" alt="BOT Chain" />
      <span>Mainnet Contract</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}
