// Plugins
require("dotenv").config({ path: "../../.env" });

import "@nomiclabs/hardhat-waffle";
import '@typechain/hardhat'

import { task } from "hardhat/config";
require('@eth-optimism/hardhat-ovm')

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.address);
  }
});



task("l2:oDAI:balance", "checks balance of account")
  .addParam('address', 'address to check balance of')
  .setAction(async (args, hre) => {
    const accounts = await hre.ethers.getSigners();

    const oDAI = new hre.ethers.Contract(
      process.env.REACT_APP_L2_DAI_ADDRESS,
      require("./artifacts-ovm/contracts/L2DepositedERC20.sol/L2DepositedERC20.json").abi,
      accounts[0]
    );
    console.log("balance", (await oDAI.balanceOf(args.address)).toString());
  });

task("l1:pool:properties")
  .setAction(async (args, hre) => {
    const accounts = await hre.ethers.getSigners();
    const pool = new hre.ethers.Contract(
      process.env.REACT_APP_L1_POOL_ADDRESS,
      require("./artifacts/contracts/L1_Pool.sol/L1_Pool.json").abi,
      accounts[0]
    );

    console.log({
      DAI: await pool.dai(),
      crvLPToken: await pool.crvLPToken(),
      YearnVault: await pool.yearnVault(),
      CurveDepositZap: await pool.curveDepositZap(),
      L1_ERC20Gateway: await pool.L1_ERC20Gateway(),
      PoolTokenEscrow: await pool.poolTokenEscrow(),
      RewardsManager: await pool.rewardsManager(),
      L2Pool: await pool.L2_Pool()
    })

  });


task("l1:pool:deposit", "withdraws from L1 pool")
  .setAction(async (args, hre) => {
    const accounts = await hre.ethers.getSigners();
    const pool = new hre.ethers.Contract(
      process.env.REACT_APP_L1_POOL_ADDRESS,
      require("./artifacts/contracts/L1_Pool.sol/L1_Pool.json").abi,
      accounts[0]
    );

    const response = await pool.deposit();
    console.log(response);
  });

task("l1:pool:withdraw", "withdraws from L1 pool")
  .addParam('amount', 'amount to withdraw')
  .addParam('withdrawto', 'address to withdraw to')
  .addParam('batchid', 'batch id')
  .setAction(async (args, hre) => {
    const accounts = await hre.ethers.getSigners();
    const pool = new hre.ethers.Contract(
      process.env.REACT_APP_L1_POOL_ADDRESS,
      require("./artifacts/contracts/L1_Pool.sol/L1_Pool.json").abi,
      accounts[0]
    );

    const response = await pool.withdraw(
      args.amount,
      args.withdrawto,
      args.batchid
    );
    console.log(response);
  });

task("l1:pool:balance", "checks balance of account")
  .addParam('address')
  .setAction(async (args, hre) => {
    const accounts = await hre.ethers.getSigners();

    const pool = new hre.ethers.Contract(
      process.env.REACT_APP_L1_POOL_ADDRESS,
      require("./artifacts/contracts/L1_Pool.sol/L1_Pool.json").abi,
      accounts[0]
    );

    console.log("balance", (await pool.balanceOf(args.address)).toString());
  });


task("l2:pool:properties")
  .setAction(async (args, hre) => {
    const accounts = await hre.ethers.getSigners();
    const pool = new hre.ethers.Contract(
      process.env.REACT_APP_L2_POOL_ADDRESS,
      require("./artifacts-ovm/contracts/L2_Pool.sol/L2_Pool.json").abi,
      accounts[0]
    );

    console.log({
      oDAI: await pool.oDAI(),
      L1_Pool: await pool.L1_Pool(),
      toDeposit: (await pool.toDeposit()).toString(),
      batchTransferPeriod: (await pool.batchTransferPeriod()).toString(),
      lastDepositMadeAt: (await pool.lastDepositMadeAt()).toString(),
      L1_Target: await pool.L1_Target(),
      currentWithdrawalBatchId: await pool.currentWithdrawalBatchId(),
      withdrawalPeriod: (await pool.withdrawalPeriod()).toString(),
      lastWithdrawalMadeAt: (await pool.lastWithdrawalMadeAt()).toString()
    })

  });

module.exports = {
  networks: {
    localhost: {
      url: "http://localhost:9545",
      accounts: {
        mnemonic: 'test test test test test test test test test test test junk'
      }
    },
    hardhat: {
      accounts: {
        mnemonic: 'test test test test test test test test test test test junk'
      }
    },
    // Add this network to your config!
    optimism: {
      url: 'http://127.0.0.1:8545',
      accounts: {
        mnemonic: 'test test test test test test test test test test test junk'
      },
      // This sets the gas price to 0 for all transactions on L2. We do this
      // because account balances are not automatically initiated with an ETH
      // balance.
      gasPrice: 0,
      ovm: true // This sets the network as using the ovm and ensure contract will be compiled against that.
    },
  },
  solidity: '0.7.6',
  ovm: {
    solcVersion: '0.7.6'
  }
}
