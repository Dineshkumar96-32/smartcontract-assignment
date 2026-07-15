const hre = require("hardhat");

async function main() {
  // Replace with your deployed ZyncToken address
  const tokenAddress = "PASTE_ZYNCTOKEN_ADDRESS_HERE";

  const Vesting = await hre.ethers.getContractFactory("ZyncVesting");
  const vesting = await Vesting.deploy(tokenAddress);

  await vesting.waitForDeployment();

  console.log("ZyncVesting deployed to:", await vesting.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});