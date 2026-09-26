import { expect } from "chai";
import hre from "hardhat";

const { ethers, networkHelpers } = await hre.network.create();
const { time } = networkHelpers;

describe("AgentGuard", function () {
  it("rejects invalid policy configurations", async function () {
    const { contract, payer } = await deployFixture();
    const expiresAt = (await time.latest()) + 3_600;

    await expect(contract.connect(payer).setPolicy(0n, 1n, expiresAt, false))
      .to.be.revertedWithCustomError(contract, "InvalidPolicy");
    await expect(contract.connect(payer).setPolicy(2n, 1n, expiresAt, false))
      .to.be.revertedWithCustomError(contract, "InvalidPolicy");
    await expect(contract.connect(payer).setPolicy(1n, 1n, await time.latest(), false))
      .to.be.revertedWithCustomError(contract, "InvalidPolicy");
  });

  it("rejects non-owner emergency pause", async function () {
    const { contract, stranger } = await deployFixture();
    await expect(contract.connect(stranger).pause()).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
  });

  it("rejects expired policy and zero intent", async function () {
    const { contract, payer, recipient } = await deployFixture();
    await expect(contract.connect(payer).executePayment(recipient.address, ethers.ZeroHash, { value: 1n }))
      .to.be.revertedWithCustomError(contract, "InvalidIntentHash");
    await time.increase(86_401);
    await expect(contract.connect(payer).executePayment(recipient.address, ethers.id("expired"), { value: 1n }))
      .to.be.revertedWithCustomError(contract, "PolicyExpired");
  });

  it("enforces daily total and isolates payer deposits", async function () {
    const { contract, payer, recipient, stranger } = await deployFixture();
    for (let i = 0; i < 5; i++) {
      await contract.connect(payer).executePayment(recipient.address, ethers.id(`daily-${i}`), { value: ethers.parseEther("0.02") });
    }
    await expect(contract.connect(payer).executePayment(recipient.address, ethers.id("daily-overflow"), { value: 1n }))
      .to.be.revertedWithCustomError(contract, "DailyLimitExceeded");
    await contract.connect(payer).deposit({ value: 100n });
    await expect(contract.connect(stranger).withdraw(100n)).to.be.revertedWithCustomError(contract, "InsufficientBalance");
    await contract.connect(payer).withdraw(100n);
    expect(await contract.depositedBalance(payer.address)).to.equal(0n);
  });

  it("maintains a bounded recipient list and removes entries safely", async function () {
    const { contract, payer, recipient, stranger } = await deployFixture();
    const contractAddress = await contract.getAddress();

    await expect(contract.connect(payer).setRecipient(ethers.ZeroAddress, true))
      .to.be.revertedWithCustomError(contract, "RecipientNotAllowed");
    await expect(contract.connect(payer).setRecipient(contractAddress, true))
      .to.be.revertedWithCustomError(contract, "RecipientNotAllowed");

    await contract.connect(payer).setRecipient(stranger.address, true);
    await contract.connect(payer).setRecipient(recipient.address, true);
    await contract.connect(payer).setRecipient(stranger.address, true);
    await contract.connect(payer).setRecipient(recipient.address, false);

    expect(await contract.allowedRecipients(payer.address)).to.deep.equal([stranger.address]);
    await contract.connect(payer).setRecipient(stranger.address, false);
    await contract.connect(payer).setRecipient(stranger.address, false);
    expect(await contract.allowedRecipients(payer.address)).to.deep.equal([]);
  });

  it("enforces the recipient-list capacity", async function () {
    const { contract, payer } = await deployFixture();
    // deployFixture already allowlists one recipient.
    for (let i = 1; i <= 99; i++) {
      const recipient = ethers.getAddress(`0x${i.toString(16).padStart(40, "0")}`);
      await contract.connect(payer).setRecipient(recipient, true);
    }

    const overflowRecipient = ethers.getAddress(`0x${(100).toString(16).padStart(40, "0")}`);
    await expect(contract.connect(payer).setRecipient(overflowRecipient, true))
      .to.be.revertedWithCustomError(contract, "TooManyRecipients");
    expect(await contract.allowedRecipients(payer.address)).to.have.length(100);
  });

  it("supports direct deposits and owner pause recovery", async function () {
    const { contract, owner, payer } = await deployFixture();
    const address = await contract.getAddress();

    await expect(contract.connect(payer).deposit({ value: 0n }))
      .to.be.revertedWithCustomError(contract, "InvalidAmount");
    await contract.connect(owner).pause();
    await expect(contract.connect(payer).deposit({ value: 1n }))
      .to.be.revertedWithCustomError(contract, "EnforcedPause");
    await contract.connect(owner).unpause();

    await payer.sendTransaction({ to: address, value: 123n });
    expect(await contract.depositedBalance(payer.address)).to.equal(123n);
  });

  it("rejects zero-value and unfunded balance operations", async function () {
    const { contract, payer, recipient } = await deployFixture();
    await expect(contract.connect(payer).withdraw(0n))
      .to.be.revertedWithCustomError(contract, "InvalidAmount");
    await expect(contract.connect(payer).executePayment(recipient.address, ethers.id("zero"), { value: 0n }))
      .to.be.revertedWithCustomError(contract, "InvalidAmount");
    await expect(contract.connect(payer).executeFromBalance(recipient.address, 0n, ethers.id("zero-balance")))
      .to.be.revertedWithCustomError(contract, "InvalidAmount");
    await expect(contract.connect(payer).executeFromBalance(recipient.address, 1n, ethers.id("unfunded")))
      .to.be.revertedWithCustomError(contract, "InsufficientBalance");
  });

  it("rejects payments without a policy or to invalid recipients", async function () {
    const { contract, payer, stranger } = await deployFixture();
    const contractAddress = await contract.getAddress();

    await expect(contract.connect(stranger).executePayment(payer.address, ethers.id("no-policy"), { value: 1n }))
      .to.be.revertedWithCustomError(contract, "InvalidPolicy");
    await expect(contract.connect(payer).executePayment(ethers.ZeroAddress, ethers.id("zero-recipient"), { value: 1n }))
      .to.be.revertedWithCustomError(contract, "RecipientNotAllowed");
    await expect(contract.connect(payer).executePayment(contractAddress, ethers.id("self-recipient"), { value: 1n }))
      .to.be.revertedWithCustomError(contract, "RecipientNotAllowed");
  });

  it("allows unlisted recipients when the allowlist is disabled", async function () {
    const { contract, payer, stranger } = await deployFixture();
    const expiresAt = (await time.latest()) + 86_400;
    await contract.connect(payer).setPolicy(100n, 200n, expiresAt, false);

    await expect(contract.connect(payer).executePayment(stranger.address, ethers.id("open-list"), { value: 10n }))
      .to.emit(contract, "PaymentExecuted");
  });

  it("rolls daily spending over while retaining policy details", async function () {
    const { contract, payer, recipient } = await deployFixture();
    const expiresAt = (await time.latest()) + 3 * 86_400;
    await contract.connect(payer).setPolicy(100n, 200n, expiresAt, true);
    await contract.connect(payer).executePayment(recipient.address, ethers.id("day-one"), { value: 10n });

    const policy = await contract.policyOf(payer.address);
    expect(policy.perTransactionLimit).to.equal(100n);
    expect(policy.dailyLimit).to.equal(200n);
    expect(policy.allowlistEnforced).to.equal(true);
    expect(policy.spent).to.equal(10n);

    await time.increase(86_400);
    expect(await contract.spentToday(payer.address)).to.equal(0n);
  });

  it("restores state when a recipient rejects native BOT", async function () {
    const { contract, payer } = await deployFixture();
    const receiver = await ethers.deployContract("RejectingReceiver");
    await receiver.waitForDeployment();
    const receiverAddress = await receiver.getAddress();
    await contract.connect(payer).setRecipient(receiverAddress, true);

    await expect(contract.connect(payer).executePayment(receiverAddress, ethers.id("reject-direct"), { value: 1n }))
      .to.be.revertedWithCustomError(contract, "TransferFailed");
    expect(await contract.usedIntentHash(payer.address, ethers.id("reject-direct"))).to.equal(false);

    await contract.connect(payer).deposit({ value: 10n });
    await expect(contract.connect(payer).executeFromBalance(receiverAddress, 1n, ethers.id("reject-balance")))
      .to.be.revertedWithCustomError(contract, "TransferFailed");
    expect(await contract.depositedBalance(payer.address)).to.equal(10n);
  });

  it("restores a contract depositor balance when withdrawal transfer fails", async function () {
    const { contract } = await deployFixture();
    const receiver = await ethers.deployContract("RejectingReceiver");
    await receiver.waitForDeployment();
    const contractAddress = await contract.getAddress();
    const receiverAddress = await receiver.getAddress();

    await receiver.depositInto(contractAddress, { value: 10n });
    await expect(receiver.withdrawFrom(contractAddress, 10n))
      .to.be.revertedWithCustomError(contract, "TransferFailed");
    expect(await contract.depositedBalance(receiverAddress)).to.equal(10n);
  });

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
