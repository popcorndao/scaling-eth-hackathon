import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import BatchWithdrawablePoolAdapter from '../utils/BatchWithdrawalablePoolAdapter';

const provider = waffle.provider;

describe('L2_Pool', function () {
  const DepositorInitial = parseEther("2000");
  let owner, depositor, depositor1, depositor2, depositor3, depositor4, depositor5, rewardsManager, poolTokenEscrow, MockL1_Pool, currentTime, MockL1_Gateway;

  const BATCH_TRANSFER_PERIOD = 10000;

  const fastForward = async () => {
    await provider.send("evm_setNextBlockTimestamp", [(await provider.getBlock("latest")).timestamp + BATCH_TRANSFER_PERIOD ]);
    await provider.send("evm_mine", undefined);
  }

  beforeEach(async function () {
    [owner, depositor, depositor1, depositor2, depositor3, depositor4, depositor5, rewardsManager, poolTokenEscrow, MockL1_Pool, MockL1_Gateway] = await ethers.getSigners();

    currentTime = (await provider.getBlock("latest")).timestamp;

    const CrossDomainMessengerFactory = await ethers.getContractFactory('Mock_OVM_CrossDomainMessenger');
    this.Mock_CrossDomainMessenger = await CrossDomainMessengerFactory.deploy();
    await this.Mock_CrossDomainMessenger.deployed();



    const L2_DepositedERC20 = await ethers.getContractFactory("L2DepositedERC20");
    this.L2_oDAI = await L2_DepositedERC20.deploy(  this.Mock_CrossDomainMessenger.address,
      'oDAI')
    await this.L2_oDAI.deployed();
    await this.L2_oDAI.init(MockL1_Gateway.address);

    await this.L2_oDAI.mint(depositor.address, DepositorInitial);
    await this.L2_oDAI.mint(depositor1.address, DepositorInitial);
    await this.L2_oDAI.mint(depositor2.address, DepositorInitial);


    const L2_PoolFactory = await ethers.getContractFactory("L2_Pool");
    this.L2_Pool = await L2_PoolFactory.deploy(
      this.L2_oDAI.address,
      MockL1_Pool.address,
      this.Mock_CrossDomainMessenger.address,
      BATCH_TRANSFER_PERIOD,
    );
    
    await this.L2_Pool.deployed();


  });

  it("should be constructed with correct addresses", async function () {
    expect(await this.L2_Pool.oDAI()).to.equal(this.L2_oDAI.address);
    expect(await this.L2_Pool.L1_Pool()).to.equal(MockL1_Pool.address);
    expect(await this.L2_Pool.messenger()).to.equal(this.Mock_CrossDomainMessenger.address)
    expect(await this.L2_Pool.batchTransferPeriod()).to.equal(10000);
  });

  it("has a token name", async function () {
    expect(await this.L2_Pool.name()).to.equal("Popcorn DAI L2 YieldOptimizerPool");
  });

  describe("deposits", async function () {

    it("doesn't deposit anything if contract doesn't have tokens", async function () {
      await expect(this.L2_Pool.connect(depositor3).deposit(parseEther('2000'))).to.be.revertedWith("not enough DAI");
    });

    it("deposits oDAI in exchange for pool tokens", async function () {
      const amount = parseEther("2000");
      await this.L2_oDAI.connect(depositor).approve(this.L2_Pool.address, amount);
      await this.L2_Pool.connect(depositor).deposit(parseEther("2000"));
      expect(await this.L2_oDAI.balanceOf(this.L2_Pool.address)).to.equal(parseEther("2000"));
      expect(await this.L2_Pool.balanceOf(depositor.address)).to.equal(parseEther("2000"));
    });

    it("increments amount to deposit on deposit", async function() {
      const amount = parseEther("2000");
      await this.L2_oDAI.connect(depositor).approve(this.L2_Pool.address, amount);
      await this.L2_Pool.connect(depositor).deposit(amount);

      await this.L2_oDAI.connect(depositor1).approve(this.L2_Pool.address, amount);
      await this.L2_Pool.connect(depositor1).deposit(amount);

      expect(await this.L2_Pool.toDeposit()).to.equal(parseEther('4000'));
    });

    it("transfers oDAI to L1_Pool", async function() {
      const amount = parseEther("2000");
      await this.L2_oDAI.connect(depositor).approve(this.L2_Pool.address, amount);
      await this.L2_Pool.connect(depositor).deposit(amount);

      await this.L2_oDAI.connect(depositor1).approve(this.L2_Pool.address, amount);
      await this.L2_Pool.connect(depositor1).deposit(amount);

      expect(await this.L2_Pool.toDeposit()).to.equal(parseEther('4000'));
      expect(await this.L2_oDAI.balanceOf(this.L2_Pool.address)).to.equal(parseEther('4000'));


      await fastForward();

      await this.L2_Pool.executeBatchDeposit();
      expect(await this.L2_Pool.toDeposit()).to.equal(0);
      expect(await this.L2_oDAI.balanceOf(this.L2_Pool.address)).to.equal(parseEther('0'));
    });
  });


  describe("withdrawals", async function () {
    it("should enqueue a withdrawal request", async function() {
      const amount = parseEther("2000");
      await this.L2_oDAI.connect(depositor1).approve(this.L2_Pool.address, amount);

      await this.L2_Pool.connect(depositor1).deposit(amount);
      await this.L2_Pool.connect(depositor1).requestWithdrawal(amount);

      const l2_pool = this.L2_Pool;
      const pool = BatchWithdrawablePoolAdapter.fromContract(l2_pool);
      const summaries = await pool.getWithdrawalSummaries(depositor1.address);

      expect(summaries[0]).to.deep.contains({
        unclaimedShares: parseEther('2000'),
        claimable: false,
        claimed: false,
        tokensToReceive: parseEther('0'),
        transferStatus: "Pending"
      });

    });


    it("should not allow executeBatchWithdrawal if not enough time has elapsed", async function() {
      const amount = parseEther("2000");
      await this.L2_oDAI.connect(depositor1).approve(this.L2_Pool.address, amount);
      await this.L2_Pool.connect(depositor1).deposit(amount);
      await this.L2_Pool.connect(depositor1).requestWithdrawal(amount); 
      await expect(this.L2_Pool.connect(depositor1).executeBatchWithdrawal()).to.be.revertedWith("can not execute batch withdrawal yet")
    });

    it("should allow executeBatchWithdrawal if enough time has elapsed", async function() {

      const amount = parseEther("2000");

      await this.L2_oDAI.connect(depositor1).approve(this.L2_Pool.address, amount);
      await this.L2_Pool.connect(depositor1).deposit(amount);

      await fastForward();

      await this.L2_Pool.connect(depositor1).requestWithdrawal(amount); 
      
      const l2_pool = this.L2_Pool;
      const pool = BatchWithdrawablePoolAdapter.fromContract(l2_pool);
      const summaries = await pool.getWithdrawalSummaries(depositor1.address);
      const vault = await pool.withdrawalVaults(summaries[0].batchId);

      expect(vault).to.deep.equal({
        unclaimedShares: parseEther("2000"),
        tokenBalance: parseEther("0"),
        transferStatus: "InTransit"
      });
    });
    
  });

});