const { expect } = require("chai");
const hre = require("hardhat");

describe("ZyncToken", function () {
  it("mints ZYNC for ETH at the public price", async function () {
    const [, buyer] = await hre.ethers.getSigners();
    const price = hre.ethers.parseEther("0.001");

    const Z = await hre.ethers.getContractFactory("ZyncToken");
    const token = await Z.deploy(price);
    await token.waitForDeployment();

    const tx = await token.connect(buyer).mintWithEth({ value: price });
    await tx.wait();

    const bal = await token.balanceOf(buyer.address);
    expect(bal).to.equal(hre.ethers.parseEther("1"));

    expect(
      await hre.ethers.provider.getBalance(await token.getAddress())
    ).to.equal(price);
  });

  it("should revert when owner sets mint price to zero", async function () {
    const price = hre.ethers.parseEther("0.001");

    const Z = await hre.ethers.getContractFactory("ZyncToken");
    const token = await Z.deploy(price);
    await token.waitForDeployment();

    await expect(
      token.setMintPrice(0)
    ).to.be.revertedWithCustomError(token, "ZeroAmount");
  });

  it("should refund excess ETH", async function () {
    const [, buyer] = await hre.ethers.getSigners();
    const price = hre.ethers.parseEther("0.001");

    const Z = await hre.ethers.getContractFactory("ZyncToken");
    const token = await Z.deploy(price);
    await token.waitForDeployment();

    await token.connect(buyer).mintWithEth({
      value: hre.ethers.parseEther("0.0019"),
    });

    expect(await token.balanceOf(buyer.address))
      .to.equal(hre.ethers.parseEther("1"));

    expect(
      await hre.ethers.provider.getBalance(await token.getAddress())
    ).to.equal(price);
  });

  it("should burn tokens", async function () {
    const [, buyer] = await hre.ethers.getSigners();
    const price = hre.ethers.parseEther("0.001");

    const Z = await hre.ethers.getContractFactory("ZyncToken");
    const token = await Z.deploy(price);
    await token.waitForDeployment();

    await token.connect(buyer).mintWithEth({
      value: price,
    });

    await token.connect(buyer).burn(
      hre.ethers.parseEther("0.5")
    );

    expect(
      await token.balanceOf(buyer.address)
    ).to.equal(hre.ethers.parseEther("0.5"));
  });

  it("should burn tokens using allowance", async function () {
    const [owner, spender] = await hre.ethers.getSigners();
    const price = hre.ethers.parseEther("0.001");

    const Z = await hre.ethers.getContractFactory("ZyncToken");
    const token = await Z.deploy(price);
    await token.waitForDeployment();

    await token.mintWithEth({
      value: price,
    });

    await token.approve(
      spender.address,
      hre.ethers.parseEther("0.5")
    );

    await token
      .connect(spender)
      .burnFrom(owner.address, hre.ethers.parseEther("0.5"));

    expect(
      await token.balanceOf(owner.address)
    ).to.equal(hre.ethers.parseEther("0.5"));
  });

  it("should fail to burn without allowance", async function () {
    const [owner, spender] = await hre.ethers.getSigners();
    const price = hre.ethers.parseEther("0.001");

    const Z = await hre.ethers.getContractFactory("ZyncToken");
    const token = await Z.deploy(price);
    await token.waitForDeployment();

    await token.mintWithEth({
      value: price,
    });

    await expect(
      token
        .connect(spender)
        .burnFrom(owner.address, hre.ethers.parseEther("0.5"))
    ).to.be.reverted;
  });

  // -------------------------------
  // Task 3 - Event Tests
  // -------------------------------

  it("should emit MintPriceUpdated event", async function () {
    const price = hre.ethers.parseEther("0.001");
    const newPrice = hre.ethers.parseEther("0.002");

    const Z = await hre.ethers.getContractFactory("ZyncToken");
    const token = await Z.deploy(price);
    await token.waitForDeployment();

    await expect(token.setMintPrice(newPrice))
      .to.emit(token, "MintPriceUpdated")
      .withArgs(price, newPrice);
  });

  it("should emit TreasuryMint event", async function () {
    const [owner, user] = await hre.ethers.getSigners();
    const price = hre.ethers.parseEther("0.001");

    const Z = await hre.ethers.getContractFactory("ZyncToken");
    const token = await Z.deploy(price);
    await token.waitForDeployment();

    const amount = hre.ethers.parseEther("10");

    await expect(token.mintTo(user.address, amount))
      .to.emit(token, "TreasuryMint")
      .withArgs(user.address, amount);
  });

  it("should emit Withdrawn event", async function () {
    const [owner, buyer] = await hre.ethers.getSigners();
    const price = hre.ethers.parseEther("0.001");

    const Z = await hre.ethers.getContractFactory("ZyncToken");
    const token = await Z.deploy(price);
    await token.waitForDeployment();

    await token.connect(buyer).mintWithEth({
      value: price,
    });

    await expect(token.withdraw())
      .to.emit(token, "Withdrawn");
  });
});