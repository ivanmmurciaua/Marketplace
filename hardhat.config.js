require("dotenv").config();

require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers : [
      {
        version : "0.5.16",
      },
      {
        version : "0.8.9",
        settings : {
          optimizer: {
            enabled: true
          }
        }
      }
    ]
  },
  gasReporter : {
    enabled: process.env.REPORT_GAS,
    currency : "EUR",
    token : "BNB",
    gasPriceApi : "https://api.bscscan.com/api?module=proxy&action=eth_gasPrice", 
    showTimeSpent : true,
    coinmarketcap : process.env.GAS_KEY
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  }
};
