const { expect } = require("chai");
const hre = require("hardhat");

describe("ZyncVesting", function () {
  it("should deploy ZyncVesting successfully", async function () {
    const price = hre.ethers.parseEther("0.001");

    // Deploy ZyncToken
    const Token = await hre.ethers.getContractFactory("ZyncToken");
    const token = await Token.deploy(price);
    await token.waitForDeployment();

    // Deploy ZyncVesting
    const Vesting = await hre.ethers.getContractFactory("ZyncVesting");
    const vesting = await Vesting.deploy(await token.getAddress());
    await vesting.waitForDeployment();

    expect(await vesting.zyncToken()).to.equal(
      await token.getAddress()
    );
  });

  it("should fund the vesting contract", async function () {
    const [owner] = await hre.ethers.getSigners();
    const price = hre.ethers.parseEther("0.001");

    // Deploy ZyncToken
    const Token = await hre.ethers.getContractFactory("ZyncToken");
    const token = await Token.deploy(price);
    await token.waitForDeployment();

    // Mint 100 ZYNC to owner
    await token.mintTo(
      owner.address,
      hre.ethers.parseEther("100")
    );

    // Deploy ZyncVesting
    const Vesting = await hre.ethers.getContractFactory("ZyncVesting");
    const vesting = await Vesting.deploy(await token.getAddress());
    await vesting.waitForDeployment();

    // Approve the vesting contract to spend 50 ZYNC
    await token.approve(
      await vesting.getAddress(),
      hre.ethers.parseEther("50")
    );

    // Fund the vesting contract
    await vesting.fund(
      hre.ethers.parseEther("50")
    );

    // Verify the vesting contract received 50 ZYNC
    expect(
      await token.balanceOf(await vesting.getAddress())
    ).to.equal(
      hre.ethers.parseEther("50")
    );
  });
});

it("should create a vesting schedule", async function () {
  const [owner, beneficiary] = await hre.ethers.getSigners();
  const price = hre.ethers.parseEther("0.001");

  // Deploy ZyncToken
  const Token = await hre.ethers.getContractFactory("ZyncToken");
  const token = await Token.deploy(price);
  await token.waitForDeployment();

  // Deploy ZyncVesting
  const Vesting = await hre.ethers.getContractFactory("ZyncVesting");
  const vesting = await Vesting.deploy(await token.getAddress());
  await vesting.waitForDeployment();

  // Current timestamp
  const latestBlock = await hre.ethers.provider.getBlock("latest");
  const start = latestBlock.timestamp;

  // Create vesting schedule
  await vesting.createVestingSchedule(
    beneficiary.address,
    hre.ethers.parseEther("100"),
    start,
    30 * 24 * 60 * 60,     // 30 days
    365 * 24 * 60 * 60     // 365 days
  );

  // Read stored schedule
  const schedule = await vesting.vestingSchedules(
    beneficiary.address
  );

  expect(schedule.totalAmount).to.equal(
    hre.ethers.parseEther("100")
  );

  expect(schedule.released).to.equal(0);

  expect(schedule.start).to.equal(start);

  expect(schedule.cliff).to.equal(
    30 * 24 * 60 * 60
  );

  expect(schedule.duration).to.equal(
    365 * 24 * 60 * 60
  );
});

it("should release vested tokens", async function () {
  const [owner, beneficiary] = await hre.ethers.getSigners();
  const price = hre.ethers.parseEther("0.001");

  // Deploy token
  const Token = await hre.ethers.getContractFactory("ZyncToken");
  const token = await Token.deploy(price);
  await token.waitForDeployment();

  // Mint tokens to owner
  await token.mintTo(owner.address, hre.ethers.parseEther("100"));

  // Deploy vesting
  const Vesting = await hre.ethers.getContractFactory("ZyncVesting");
  const vesting = await Vesting.deploy(await token.getAddress());
  await vesting.waitForDeployment();

  // Fund vesting contract
  await token.approve(
    await vesting.getAddress(),
    hre.ethers.parseEther("100")
  );

  await vesting.fund(hre.ethers.parseEther("100"));

  // Current block timestamp
  const latestBlock = await hre.ethers.provider.getBlock("latest");
  const start = latestBlock.timestamp;

  // Create schedule
  await vesting.createVestingSchedule(
    beneficiary.address,
    hre.ethers.parseEther("100"),
    start,
    0,      // no cliff
    100     // duration = 100 seconds
  );

  // Move blockchain forward 100 seconds
  await hre.network.provider.send("evm_increaseTime", [100]);
  await hre.network.provider.send("evm_mine");

  // Release tokens
  await vesting.connect(beneficiary).release();

  // Beneficiary should receive all 100 tokens
  expect(
    await token.balanceOf(beneficiary.address)
  ).to.equal(hre.ethers.parseEther("100"));
});

it("should not release tokens before cliff", async function () {
  const [owner, beneficiary] = await hre.ethers.getSigners();
  const price = hre.ethers.parseEther("0.001");

  const Token = await hre.ethers.getContractFactory("ZyncToken");
  const token = await Token.deploy(price);
  await token.waitForDeployment();

  await token.mintTo(owner.address, hre.ethers.parseEther("100"));

  const Vesting = await hre.ethers.getContractFactory("ZyncVesting");
  const vesting = await Vesting.deploy(await token.getAddress());
  await vesting.waitForDeployment();

  await token.approve(
    await vesting.getAddress(),
    hre.ethers.parseEther("100")
  );

  await vesting.fund(hre.ethers.parseEther("100"));

  const latestBlock = await hre.ethers.provider.getBlock("latest");
  const start = latestBlock.timestamp;

  await vesting.createVestingSchedule(
    beneficiary.address,
    hre.ethers.parseEther("100"),
    start,
    100,   // cliff = 100 seconds
    200
  );

  await expect(
    vesting.connect(beneficiary).release()
  ).to.be.revertedWith("No tokens to release");
});

it("should not release tokens twice", async function () {
  const [owner, beneficiary] = await hre.ethers.getSigners();
  const price = hre.ethers.parseEther("0.001");

  // Deploy ZyncToken
  const Token = await hre.ethers.getContractFactory("ZyncToken");
  const token = await Token.deploy(price);
  await token.waitForDeployment();

  // Mint tokens to owner
  await token.mintTo(owner.address, hre.ethers.parseEther("100"));

  // Deploy Vesting
  const Vesting = await hre.ethers.getContractFactory("ZyncVesting");
  const vesting = await Vesting.deploy(await token.getAddress());
  await vesting.waitForDeployment();

  // Fund vesting contract
  await token.approve(
    await vesting.getAddress(),
    hre.ethers.parseEther("100")
  );

  await vesting.fund(hre.ethers.parseEther("100"));

  // Create schedule
  const latestBlock = await hre.ethers.provider.getBlock("latest");
  const start = latestBlock.timestamp;

  await vesting.createVestingSchedule(
    beneficiary.address,
    hre.ethers.parseEther("100"),
    start,
    0,
    100
  );

  // Move time forward
  await hre.network.provider.send("evm_increaseTime", [100]);
  await hre.network.provider.send("evm_mine");

  // First release
  await vesting.connect(beneficiary).release();

  // Second release should fail
  await expect(
    vesting.connect(beneficiary).release()
  ).to.be.revertedWith("No tokens to release");
});