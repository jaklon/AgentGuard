import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import type { HardhatUserConfig } from "hardhat/config";

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
const accounts = deployerKey ? [deployerKey] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 500 },
    },
  },
  networks: {
    botchainTestnet: {
      url: process.env.BOTCHAIN_TESTNET_RPC_URL ?? "https://rpc.bohr.life",
      chainId: 968,
      accounts,
    },
    botchainMainnet: {
      url: process.env.BOTCHAIN_MAINNET_RPC_URL ?? "https://rpc.botchain.ai",
      chainId: 677,
      accounts,
    },
  },
  mocha: {
    timeout: 30_000,
  },
};

export default config;
