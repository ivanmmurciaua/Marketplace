// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require("hardhat");

// Variables
const BUSD_ADDRESS = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
const PAD_ADDRESS = "0xcD46C2038D37bF215C5628975d8cDc9DFb65f0b9";
const FEE_RECEIVER_1 = "0x5686a2F9127FE5C3b38759B916d83613EC738B8E";
const FEE_RECEIVER_2 = "0xC3385893B529bE53488E067b91347411a2e21B1a";
const FEES_PERCENTAGE = 5;
const BNB_FEES = 1200000000000000
const min_fees = 30;
const max_fees = 70;

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // const BUSD = await ethers.getContractFactory("BEP20Token");
  // busd = await BUSD.deploy();
  // await busd.deployed();
  // console.log("Address BUSD",busd.address)

  const MarketPlace = await ethers.getContractFactory("PADMarket");
  pad_market = await upgrades.deployProxy(MarketPlace,[BUSD_ADDRESS, PAD_ADDRESS, FEE_RECEIVER_1, FEE_RECEIVER_2, FEES_PERCENTAGE, BNB_FEES, min_fees, max_fees], { kind: 'uups' });
  await pad_market.deployed();

  console.log("PAD Marketplace contract deployed to: ", pad_market.address);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
