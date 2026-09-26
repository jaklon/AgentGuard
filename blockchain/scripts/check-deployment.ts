import { getAddress } from "ethers";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import hre from "hardhat";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function executableBytecode(bytecode: string): string {
  const hex = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  if (hex.length < 4) throw new Error("Contract bytecode is too short to contain Solidity metadata");
  const metadataLength = Number.parseInt(hex.slice(-4), 16);
  const metadataHexLength = (metadataLength + 2) * 2;
  if (metadataHexLength > hex.length) {
    throw new Error("Contract bytecode contains invalid Solidity metadata length");
  }
  return `0x${hex.slice(0, hex.length - metadataHexLength)}`.toLowerCase();
}

async function main() {
  const { ethers, networkName, networkConfig } = await hre.network.create();
  const address = getAddress(required("AGENTGUARD_CONTRACT_ADDRESS"));
  const expectedOwner = getAddress(required("CONTRACT_OWNER_ADDRESS"));
  const expectedChainId = networkConfig.chainId;
  if (!expectedChainId) {
    throw new Error("The selected Hardhat network must define chainId");
  }

  const actualNetwork = await ethers.provider.getNetwork();
  if (actualNetwork.chainId !== BigInt(expectedChainId)) {
    throw new Error(`RPC chain mismatch: expected ${expectedChainId}, received ${actualNetwork.chainId}`);
  }

  const artifactsDirectory = await hre.solidity.getArtifactsDirectory("contracts");
  const artifactPath = join(artifactsDirectory, "contracts", "AgentGuard.sol", "AgentGuard.json");
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
    deployedBytecode: string;
  };
  const code = await ethers.provider.getCode(address);
  if (code === "0x") {
    throw new Error("No contract bytecode exists at AGENTGUARD_CONTRACT_ADDRESS");
  }
  const metadataHashVerified = code.toLowerCase() === artifact.deployedBytecode.toLowerCase();
  if (executableBytecode(code) !== executableBytecode(artifact.deployedBytecode)) {
    throw new Error("On-chain executable bytecode does not match the local AgentGuard artifact");
  }

  const contract = await ethers.getContractAt([
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
  ], address);
  const owner = getAddress(await contract.owner());
  if (owner !== expectedOwner) {
    throw new Error("On-chain owner does not match CONTRACT_OWNER_ADDRESS");
  }

  console.log(JSON.stringify({
    contract: "AgentGuard",
    network: networkName,
    chainId: Number(actualNetwork.chainId),
    runtimeBytecodeVerified: true,
    metadataHashVerified,
    ownerVerified: true,
    paused: Boolean(await contract.paused()),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
