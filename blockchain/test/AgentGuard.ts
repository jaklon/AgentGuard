import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentGuard", function () {
  async function deployFixture() {
    const [owner, payer, recipient, stranger] = await ethers.getSigners();
    const contract = await ethers.deployContract("AgentGuard", [owner.address]);
    await contract.waitForDeployment();
    const expiresAt = (await time.latest()) + 86_400;
    await contract.connect(payer).setPolicy(
      ethers.parseEther("0.02"),
      ethers.parseEther("0.10"),
      expiresAt,
      true,
    );
    await contract.connect(payer).setRecipient(recipient.address, true);
    expect(await contract.owner()).to.equal(owner.address);
    return { contract, owner, payer, recipient, stranger };
  }

  it("executes an allowed native BOT payment and records the intent", async function () {
    const { contract, payer, recipient } = await deployFixture();
    const intentHash = ethers.id("allow-demo-1");
    const value = ethers.parseEther("0.01");

    await expect(
      contract.connect(payer).executePayment(recipient.address, intentHash, { value }),
    )
      .to.emit(contract, "PaymentExecuted")
      .withArgs(payer.address, recipient.address, value, intentHash, false);

    expect(await contract.spentToday(payer.address)).to.equal(value);
    expect(await contract.usedIntentHash(payer.address, intentHash)).to.equal(true);
  });

  it("blocks a payment above the transaction limit", async function () {
    const { contract, payer, recipient } = await deployFixture();
    await expect(
      contract
        .connect(payer)
        .executePayment(recipient.address, ethers.id("too-large"), {
          value: ethers.parseEther("0.05"),
        }),
    ).to.be.revertedWithCustomError(contract, "TransactionLimitExceeded");
  });

  it("blocks an unlisted recipient and a repeated intent", async function () {
    const { contract, payer, recipient, stranger } = await deployFixture();
    await expect(
      contract.connect(payer).executePayment(stranger.address, ethers.id("unlisted"), {
        value: ethers.parseEther("0.01"),
      }),
    ).to.be.revertedWithCustomError(contract, "RecipientNotAllowed");

    const hash = ethers.id("one-time");
    await contract.connect(payer).executePayment(recipient.address, hash, {
      value: ethers.parseEther("0.01"),
    });
    await expect(
      contract.connect(payer).executePayment(recipient.address, hash, {
        value: ethers.parseEther("0.01"),
      }),
    ).to.be.revertedWithCustomError(contract, "IntentAlreadyUsed");
  });

  it("enforces wallet and global pause controls", async function () {
    const { contract, owner, payer, recipient } = await deployFixture();
    await contract.connect(payer).setWalletPaused(true);
    await expect(
      contract.connect(payer).executePayment(recipient.address, ethers.id("wallet-paused"), {
        value: ethers.parseEther("0.01"),
      }),
    ).to.be.revertedWithCustomError(contract, "WalletPaused");

    await contract.connect(payer).setWalletPaused(false);
    await contract.connect(owner).pause();
    await expect(
      contract.connect(payer).executePayment(recipient.address, ethers.id("global-paused"), {
        value: ethers.parseEther("0.01"),
      }),
    ).to.be.revertedWithCustomError(contract, "EnforcedPause");
  });

  it("supports deposits and guarded payments from balance", async function () {
    const { contract, payer, recipient } = await deployFixture();
    await expect(contract.connect(payer).deposit({ value: ethers.parseEther("0.02") }))
      .to.emit(contract, "Deposit")
      .withArgs(payer.address, ethers.parseEther("0.02"));

    await contract
      .connect(payer)
      .executeFromBalance(recipient.address, ethers.parseEther("0.01"), ethers.id("vault"));
    expect(await contract.depositedBalance(payer.address)).to.equal(
      ethers.parseEther("0.01"),
    );
  });
});
