import { ethers, network } from "hardhat";

async function main() {
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required; use a dedicated low-value wallet");
  }
  if (
    network.config.chainId === 677 &&
    process.env.ALLOW_MAINNET_DEPLOYMENT !== "true"
  ) {
    throw new Error("Mainnet release gate is closed (ALLOW_MAINNET_DEPLOYMENT is not true)");
  }
  if (![968, 677].includes(network.config.chainId ?? 0)) {
    throw new Error("Deployment is restricted to BOT Chain testnet or mainnet");
  }

  const owner = process.env.CONTRACT_OWNER_ADDRESS?.trim();
  if (!owner || !ethers.isAddress(owner)) {
    throw new Error("CONTRACT_OWNER_ADDRESS must be a valid EVM address");
  }

  const contract = await ethers.deployContract("AgentGuard", [ethers.getAddress(owner)]);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(
    JSON.stringify(
      {
        contract: "AgentGuard",
        address,
        chainId: network.config.chainId,
        network: network.name,
        deployer: (await ethers.getSigners())[0].address,
        owner: ethers.getAddress(owner),
        deploymentTransaction: contract.deploymentTransaction()?.hash,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
