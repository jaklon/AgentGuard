import { defineChain, http, isAddress, type Address } from "viem";
import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

const chainId = Number(import.meta.env.VITE_BOTCHAIN_CHAIN_ID ?? "968");
const rpcUrl = import.meta.env.VITE_BOTCHAIN_RPC_URL ?? "https://rpc.bohr.life";
const explorerUrl =
  import.meta.env.VITE_BOTCHAIN_EXPLORER_URL ?? "https://scan.bohr.life";
const configuredAddress = import.meta.env.VITE_BOTCHAIN_CONTRACT_ADDRESS ?? "";

export const botChainTestnet = defineChain({
  id: chainId,
  name: "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: {
    default: { name: "BOTScan", url: explorerUrl },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [botChainTestnet],
  connectors: [injected()],
  transports: {
    [botChainTestnet.id]: http(rpcUrl),
  },
});

export const contractAddress: Address | undefined = isAddress(configuredAddress)
  ? configuredAddress
  : undefined;
export const explorerBaseUrl = explorerUrl;

export const agentGuardAbi = [
  {
    type: "function",
    name: "setPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "perTransactionLimit", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
      { name: "expiresAt", type: "uint64" },
      { name: "allowlistEnforced", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setRecipient",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "executePayment",
    stateMutability: "payable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "intentHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;
