import "dotenv/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
const accounts = deployerKey ? [deployerKey] : [];

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 500 },
      evmVersion: "paris",
    },
  },
  networks: {
    botchainTestnet: {
      type: "http",
      chainType: "l1",
      url: process.env.BOTCHAIN_TESTNET_RPC_URL ?? "https://rpc.bohr.life",
      chainId: 968,
      accounts,
    },
    botchainMainnet: {
      type: "http",
      chainType: "l1",
      url: process.env.BOTCHAIN_MAINNET_RPC_URL ?? "https://rpc.botchain.ai",
      chainId: 677,
      accounts,
    },
  },
  chainDescriptors: {
    968: {
      name: "BOT Chain Testnet",
      chainType: "l1",
      blockExplorers: {
        blockscout: {
          name: "BOTScan Testnet",
          url: "https://scan.bohr.life",
          apiUrl: "https://scan.bohr.life/api",
        },
      },
    },
    677: {
      name: "BOT Chain Mainnet",
      chainType: "l1",
      blockExplorers: {
        blockscout: {
          name: "BOTScan Mainnet",
          url: "https://scan.botchain.ai",
          apiUrl: "https://scan.botchain.ai/api",
        },
      },
    },
  },
  test: {
    mocha: {
      timeout: 30_000,
    },
  },
});
