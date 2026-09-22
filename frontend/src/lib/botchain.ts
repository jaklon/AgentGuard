import { BrowserProvider, Contract, getAddress, hexlify, parseEther, randomBytes } from "ethers";

export const BOT_CHAIN_ID = 968;
export const BOT_CHAIN_HEX_ID = "0x3c8";
export type Eip1193Provider = { request(args: { method: string; params?: unknown[] | object }): Promise<unknown>; on?(event: string, listener: (...args: unknown[]) => void): void; removeListener?(event: string, listener: (...args: unknown[]) => void): void; };
declare global { interface Window { ethereum?: Eip1193Provider; } }
export type PublicConfig = { chain_id: number; chain_name: string; rpc_url: string; explorer_url: string; contract_address: string; allocation_wallet: string; };
export type Policy = { wallet: string; chain_id: number; per_transaction_limit_bot: string; daily_limit_bot: string; spent_today_bot: string; expires_at: string | null; allowlist_enforced: boolean; allowed_recipients: string[]; paused: boolean; };
export type GuardDecision = { decision: "ALLOW" | "WARN" | "BLOCK"; risk_score: number; reason: string; intent: { recipient: string; amount_bot: string; chain_id: number; purpose: string } | null; warnings: string[]; source: string; evaluated_at: string; };
export type TransactionStatus = { transaction_hash: string; status: "pending" | "confirmed" | "reverted"; block_number: number | null; explorer_url: string; };
export type RecipientAlias = { name: string; address: string; };
const ABI = ["function setPolicy(uint256,uint256,uint64,bool)", "function setRecipient(address,bool)", "function setWalletPaused(bool)", "function executePayment(address,bytes32) payable"];
function injected(): Eip1193Provider { if (!window.ethereum) throw new Error("MetaMask or another EVM wallet is required"); return window.ethereum; }
export async function api<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.detail?.message ?? body?.detail ?? "Request failed"); return body as T; }
export const getPublicConfig = () => api<PublicConfig>("/api/config");
export const policyOf = (wallet: string) => api<Policy>("/api/botchain/policy/" + wallet);
export async function connectWallet(config: PublicConfig): Promise<string> { const accounts = await injected().request({ method: "eth_requestAccounts" }) as string[]; if (!accounts[0]) throw new Error("Wallet did not return an account"); await ensureBotTestnet(config); return getAddress(accounts[0]); }
export async function ensureBotTestnet(config: PublicConfig): Promise<void> { const provider = injected(); const chain = await provider.request({ method: "eth_chainId" }) as string; if (Number.parseInt(chain, 16) === BOT_CHAIN_ID) return; try { await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BOT_CHAIN_HEX_ID }] }); } catch (error: unknown) { if ((error as { code?: number }).code !== 4902) throw error; await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: BOT_CHAIN_HEX_ID, chainName: config.chain_name, nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 }, rpcUrls: [config.rpc_url], blockExplorerUrls: [config.explorer_url] }] }); } }
export const newIntentHash = () => hexlify(randomBytes(32));
export function evaluatePayment(wallet: string, prompt: string, recipientAliases: RecipientAlias[]) { return api<GuardDecision>("/api/guard/evaluate", { method: "POST", body: JSON.stringify({ wallet, prompt, recipient_aliases: recipientAliases }) }); }
export function simulatePayment(wallet: string, recipient: string, amount_bot: string, intent_hash: string) { return api<{ allowed: boolean; reason: string; estimated_gas: number | null }>("/api/botchain/simulate", { method: "POST", body: JSON.stringify({ wallet, recipient, amount_bot, intent_hash }) }); }
export const transactionOf = (hash: string) => api<TransactionStatus>("/api/botchain/transaction/" + hash);
async function contract(config: PublicConfig) { return new Contract(config.contract_address, ABI, await new BrowserProvider(injected()).getSigner()); }
export async function executePayment(config: PublicConfig, recipient: string, amount: string, hash: string) { const tx = await (await contract(config)).executePayment(getAddress(recipient), hash, { value: parseEther(amount) }); return tx.hash as string; }
export async function setPolicy(config: PublicConfig, perTx: string, daily: string, expiry: number, enforce: boolean) { const tx = await (await contract(config)).setPolicy(parseEther(perTx), parseEther(daily), expiry, enforce); await tx.wait(); return tx.hash as string; }
export async function setRecipient(config: PublicConfig, recipient: string, allowed: boolean) { const tx = await (await contract(config)).setRecipient(getAddress(recipient), allowed); await tx.wait(); return tx.hash as string; }
export async function setWalletPaused(config: PublicConfig, paused: boolean) { const tx = await (await contract(config)).setWalletPaused(paused); await tx.wait(); return tx.hash as string; }
