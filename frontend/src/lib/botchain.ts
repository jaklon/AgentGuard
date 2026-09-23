import { BrowserProvider, Contract, getAddress, hexlify, parseEther, randomBytes } from "ethers";

export const BOT_CHAIN_ID = 968;
export const BOT_CHAIN_HEX_ID = "0x3c8";

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

export type WalletConnectionMode = "injected" | "walletconnect";
export type WalletConnection = {
  account: string;
  provider: Eip1193Provider;
  mode: WalletConnectionMode;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export type PublicConfig = { chain_id: number; chain_name: string; rpc_url: string; explorer_url: string; contract_address: string; allocation_wallet: string; faucet_url: string; bundler_url: string; entry_point: string; gasless_available: boolean; };
export type Policy = { wallet: string; chain_id: number; per_transaction_limit_bot: string; daily_limit_bot: string; spent_today_bot: string; expires_at: string | null; allowlist_enforced: boolean; allowed_recipients: string[]; paused: boolean; };
export type GuardDecision = { decision: "ALLOW" | "WARN" | "BLOCK"; risk_score: number; reason: string; intent: { recipient: string; amount_bot: string; chain_id: number; purpose: string } | null; warnings: string[]; source: string; evaluated_at: string; };
export type TransactionStatus = { transaction_hash: string; status: "pending" | "confirmed" | "reverted"; block_number: number | null; explorer_url: string; };
export type SimulationPreview = { allowed: boolean; reason: string; estimated_gas: number | null; estimated_fee_bot: string | null; wallet_balance_bot: string | null; balance_after_bot: string | null; contract_address: string | null; };
export type PaymentHistoryItem = { transaction_hash: string; block_number: number; timestamp: string; payer: string; recipient: string; amount_bot: string; intent_hash: string; funded_from_balance: boolean; explorer_url: string; };
export type RecipientPaymentSummary = { recipient: string; payment_count: number; total_amount_bot: string; };
export type PaymentHistory = { wallet: string; total_count: number; total_spent_bot: string; recipient_summaries: RecipientPaymentSummary[]; items: PaymentHistoryItem[]; };
export type WalletReadiness = { wallet: string; balance_bot: string; chain_id: number; bundler_available: boolean; gasless_available: boolean; entry_point: string; faucet_url: string; };
export type ComponentHealth = { status: "ok" | "error" | "fallback" | string; detail: string | null; };
export type HealthStatus = { status: "ok" | "degraded" | string; app_env: string; database: ComponentHealth; ai_provider: ComponentHealth; botchain_rpc: ComponentHealth; };
export type RecipientAlias = { name: string; address: string; };

type WalletConnectProvider = Eip1193Provider & {
  enable(): Promise<string[]>;
};

const ABI = [
  "function setPolicy(uint256,uint256,uint64,bool)",
  "function setRecipient(address,bool)",
  "function setWalletPaused(bool)",
  "function executePayment(address,bytes32) payable",
];
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "";
let walletConnectProviderPromise: Promise<WalletConnectProvider> | null = null;

export function injectedWalletAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export function walletConnectConfigured(): boolean {
  return Boolean(WALLETCONNECT_PROJECT_ID);
}

export function metaMaskDeepLink(pageUrl?: string): string {
  const value = pageUrl || (typeof window !== "undefined" ? window.location.href : "https://agentguard.my.id/");
  try {
    const url = new URL(value);
    return `https://metamask.app.link/dapp/${url.host}${url.pathname}${url.search}`;
  } catch {
    return "https://metamask.app.link/dapp/agentguard.my.id/";
  }
}

function injectedProvider(): Eip1193Provider {
  if (!injectedWalletAvailable()) throw new Error("No browser wallet detected. Open AgentGuard in your wallet app or use WalletConnect.");
  return window.ethereum!;
}

async function walletConnectProvider(config: PublicConfig): Promise<WalletConnectProvider> {
  if (!WALLETCONNECT_PROJECT_ID) {
    throw new Error("WalletConnect is not configured yet. Open AgentGuard in MetaMask Mobile or ask the operator to add a Reown Project ID.");
  }
  if (!walletConnectProviderPromise) {
    walletConnectProviderPromise = import("@walletconnect/ethereum-provider")
      .then(({ EthereumProvider }) => EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [BOT_CHAIN_ID],
        showQrModal: true,
        rpcMap: { [BOT_CHAIN_ID]: config.rpc_url },
        metadata: {
          name: "AgentGuard",
          description: "Policy-protected AI payments on BOT Testnet",
          url: window.location.origin,
          icons: [`${window.location.origin}/brand/agentguard-logo.png`],
        },
        qrModalOptions: {
          themeMode: "dark",
          themeVariables: { "--wcm-accent-fill-color": "#d6c38c" },
        },
      }) as Promise<WalletConnectProvider>)
      .catch((error) => {
        walletConnectProviderPromise = null;
        throw error;
      });
  }
  return walletConnectProviderPromise;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.detail?.message ?? body?.detail ?? "Request failed");
  return body as T;
}

export const getPublicConfig = () => api<PublicConfig>("/api/config");
export const getHealth = () => api<HealthStatus>("/api/health");
export const policyOf = (wallet: string) => api<Policy>("/api/botchain/policy/" + wallet);

export async function connectWallet(
  config: PublicConfig,
  mode: WalletConnectionMode = injectedWalletAvailable() ? "injected" : "walletconnect",
): Promise<WalletConnection> {
  const provider = mode === "injected" ? injectedProvider() : await walletConnectProvider(config);
  const accounts = mode === "walletconnect"
    ? await (provider as WalletConnectProvider).enable()
    : await provider.request({ method: "eth_requestAccounts" }) as string[];
  if (!accounts[0]) throw new Error("Wallet did not return an account");
  await ensureBotTestnet(config, provider);
  return { account: getAddress(accounts[0]), provider, mode };
}

export async function ensureBotTestnet(config: PublicConfig, provider: Eip1193Provider): Promise<void> {
  const chain = await provider.request({ method: "eth_chainId" }) as string;
  if (Number.parseInt(chain, 16) === BOT_CHAIN_ID) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BOT_CHAIN_HEX_ID }] });
  } catch (error: unknown) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: BOT_CHAIN_HEX_ID,
        chainName: config.chain_name,
        nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
        rpcUrls: [config.rpc_url],
        blockExplorerUrls: [config.explorer_url],
      }],
    });
  }
}

export const newIntentHash = () => hexlify(randomBytes(32));
export function evaluatePayment(wallet: string, prompt: string, recipientAliases: RecipientAlias[]) { return api<GuardDecision>("/api/guard/evaluate", { method: "POST", body: JSON.stringify({ wallet, prompt, recipient_aliases: recipientAliases }) }); }
export function simulatePayment(wallet: string, recipient: string, amount_bot: string, intent_hash: string) { return api<SimulationPreview>("/api/botchain/simulate", { method: "POST", body: JSON.stringify({ wallet, recipient, amount_bot, intent_hash }) }); }
export const transactionOf = (hash: string) => api<TransactionStatus>("/api/botchain/transaction/" + hash);
export const historyOf = (wallet: string) => api<PaymentHistory>("/api/botchain/history/" + wallet);
export const readinessOf = (wallet: string) => api<WalletReadiness>("/api/botchain/readiness/" + wallet);

async function contract(config: PublicConfig, provider: Eip1193Provider, account?: string) {
  return new Contract(config.contract_address, ABI, await new BrowserProvider(provider).getSigner(account ? getAddress(account) : undefined));
}

export async function executePayment(config: PublicConfig, provider: Eip1193Provider, payer: string, recipient: string, amount: string, hash: string) {
  const tx = await (await contract(config, provider, payer)).executePayment(getAddress(recipient), hash, { value: parseEther(amount) });
  return tx.hash as string;
}

export async function setPolicy(config: PublicConfig, provider: Eip1193Provider, perTx: string, daily: string, expiry: number, enforce: boolean) {
  const tx = await (await contract(config, provider)).setPolicy(parseEther(perTx), parseEther(daily), expiry, enforce);
  await tx.wait();
  return tx.hash as string;
}

export async function setRecipient(config: PublicConfig, provider: Eip1193Provider, recipient: string, allowed: boolean) {
  const tx = await (await contract(config, provider)).setRecipient(getAddress(recipient), allowed);
  await tx.wait();
  return tx.hash as string;
}

export async function setWalletPaused(config: PublicConfig, provider: Eip1193Provider, paused: boolean) {
  const tx = await (await contract(config, provider)).setWalletPaused(paused);
  await tx.wait();
  return tx.hash as string;
}
