import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { BigNumber } from "ethers";

const provider = waffle.provider;

describe('L1_Pool', function () {
  const DepositorInitial = parseEther("10000000");
  let MockERC20, MockYearnV2Vault, MockCurveDepositZap, L1_Pool;
  let owner, depositor, depositor1, depositor2, depositor3, depositor4, depositor5, rewardsManager;

  beforeEach(async function () {
    [owner, depositor, depositor1, depositor2, depositor3, depositor4, depositor5, rewardsManager] = await ethers.getSigners();

    MockERC20 = await ethers.getContractFactory("MockERC20");
    this.mockDai = await MockERC20.deploy("DAI", "DAI");
    await this.mockDai.mint(depositor.address, DepositorInitial);
    await this.mockDai.mint(depositor1.address, DepositorInitial);
    await this.mockDai.mint(depositor2.address, DepositorInitial);

    this.mockCrvUSDX = await MockERC20.deploy("crvUSDX", "crvUSDX");

    MockYearnV2Vault = await ethers.getContractFactory("MockYearnV2Vault");
    this.mockYearnVault = await MockYearnV2Vault.deploy(this.mockCrvUSDX.address);

    MockCurveDepositZap = await ethers.getContractFactory("MockCurveDepositZap");
    this.mockCurveDepositZap = await MockCurveDepositZap.deploy(this.mockCrvUSDX.address, this.mockDai.address);

    L1_Pool = await ethers.getContractFactory("L1_Pool");
    this.L1_Pool = await L1_Pool.deploy(
      this.mockDai.address,
      this.mockYearnVault.address,
      this.mockCurveDepositZap.address,
      rewardsManager.address,
    );
    await this.L1_Pool.deployed();
  });

  it("should be constructed with correct addresses", async function () {
    expect(await this.L1_Pool.dai()).to.equal(this.mockDai.address);
    expect(await this.L1_Pool.curveDepositZap()).to.equal(this.mockCurveDepositZap.address);
    expect(await this.L1_Pool.rewardsManager()).to.equal(rewardsManager.address);
  });

  it("has a token name", async function () {
    expect(await this.L1_Pool.name()).to.equal("Popcorn DAI L1_Pool");
  });

  it("has a token symbol", async function () {
    expect(await this.L1_Pool.symbol()).to.equal("L1_popDAI");
  });

  it("uses 18 decimals", async function () {
    expect(await this.L1_Pool.decimals()).to.equal(18);
  });

  describe("deposits", async function () {
    xit("accepts DAI deposits", async function () {
      let amount = parseEther("10");
      await this.mockDai.connect(depositor).approve(this.L1_Pool.address, amount);
      await this.L1_Pool.connect(depositor).deposit(amount);
      expect(await this.mockDai.connect(depositor).balanceOf(this.L1_Pool.address)).to.equal(amount);
    });

    it("reverts unapproved deposits", async function () {
      let amount = parseEther("10");
      await expect(this.L1_Pool.connect(depositor).deposit(amount)).to.be.revertedWith("transfer amount exceeds allowance");
    });

    it("returns popDAI to depositor", async function () {
      let amount = parseEther("23");
      await this.mockDai.connect(depositor).approve(this.L1_Pool.address, amount);
      await this.L1_Pool.connect(depositor).deposit(amount);
      expect(await this.L1_Pool.connect(depositor).balanceOf(depositor.address)).to.equal(amount);
    });

    xit("deposits DAI to the USDX Curve L1_Pool in exchange for crvUSDX", async function () {
      let amount = parseEther("31");
      await this.mockDai.connect(depositor).approve(this.L1_Pool.address, amount);
      await this.L1_Pool.connect(depositor).deposit(amount);
      expect(await this.mockCrvUSDX.connect(depositor).balanceOf(this.L1_Pool.address)).to.equal(amount);
    });

    it("deposits crvUSDX to Yearn in exchange for yvUSDX", async function () {
      let amount = parseEther("2000");
      await this.mockDai.connect(depositor).approve(this.L1_Pool.address, amount);
      await this.L1_Pool.connect(depositor).deposit(amount);
      expect(await this.mockYearnVault.connect(depositor).balanceOf(this.L1_Pool.address)).to.equal(parseEther("2000"));
    });
  });

  describe("calculating total assets", async function () {
    it("total assets is Yearn balance * Yearn price per share - slippage from conversion to DAI", async function () {
      let amount = parseEther("3700");
      await this.mockDai.connect(depositor).approve(this.L1_Pool.address, amount);
      await this.L1_Pool.connect(depositor).deposit(amount);
      expect(await this.L1_Pool.totalValue()).to.equal(parseUnits("3696300000000000000000", "wei"));
    });
  });

  describe("L1_Pool token accounting", async function () {
    it("depositor earns tokens equal to deposit when L1_Pool is empty", async function () {
      let depositAmount  = parseEther("4300");
      await this.mockDai.connect(depositor).approve(this.L1_Pool.address, depositAmount);
      await this.L1_Pool.connect(depositor).deposit(depositAmount);
      expect(await this.L1_Pool.balanceOf(depositor.address)).to.equal(depositAmount);
    });

    it("deposits emit an event", async function () {
      let depositAmount  = parseEther("4300");
      await this.mockDai.connect(depositor).approve(this.L1_Pool.address, depositAmount);
      expect(await this.L1_Pool.connect(depositor).deposit(depositAmount)).to
        .emit(this.L1_Pool, "Deposit").withArgs(depositor.address, parseEther("4300"), parseEther("4300"));
    });

    it("depositors earn tokens proportional to contributions", async function () {
      let deposit1Amount = parseEther("3000");
      let deposit2Amount = parseEther("7000");
      let deposit3Amount = parseEther("11000");

      await this.mockDai.connect(depositor1).approve(this.L1_Pool.address, deposit1Amount);
      await this.L1_Pool.connect(depositor1).deposit(deposit1Amount);

      await this.mockDai.connect(depositor2).approve(this.L1_Pool.address, deposit2Amount);
      await this.L1_Pool.connect(depositor2).deposit(deposit2Amount);
      await this.mockDai.connect(depositor2).approve(this.L1_Pool.address, deposit3Amount);
      await this.L1_Pool.connect(depositor2).deposit(deposit3Amount);

      expect(await this.L1_Pool.balanceOf(depositor1.address)).to.equal(deposit1Amount);
      expect(await this.L1_Pool.balanceOf(depositor2.address)).to.equal(deposit2Amount.add(deposit3Amount));
    });


    it("tokens convert at higher rate on withdrawal when underlying Yearn vault value increases", async function () {
      let deposit1Amount = parseEther("10000");

      await this.mockDai.connect(depositor1).approve(this.L1_Pool.address, deposit1Amount);
      await this.L1_Pool.connect(depositor1).deposit(deposit1Amount);

      expect(await this.L1_Pool.balanceOf(depositor1.address)).to.equal(parseEther("10000"));
      expect(await this.mockDai.balanceOf(depositor1.address)).to.equal(parseEther("9990000"));

      this.mockYearnVault.setTotalAssets(parseEther("20000"));
      let withdrawal1Amount = parseEther("10000");
      await expect(await this.L1_Pool.connect(depositor1).withdraw(withdrawal1Amount)).to
        .emit(this.L1_Pool, "Withdrawal").withArgs(
          depositor1.address,
          parseEther("19980")
        );
      expect(await this.L1_Pool.balanceOf(depositor1.address)).to.equal(parseEther("0"));
      let depositor1DaiBalance = await this.mockDai.balanceOf(depositor1.address);
      expect(depositor1DaiBalance).to.equal(parseEther("10009980"));
    });

    it("handles multiple deposits", async function () {

      const parseDeposits = (deposits: number[]): BigNumber[] =>  {
        return deposits.map(deposit => parseEther(deposit.toString()));
      }

      const makeDeposits = async (depositor: string, deposits: BigNumber[]) => {
        const sumOfDeposits = deposits.reduce((sum, deposit) => sum.add(deposit), parseEther('0'));
        await this.mockDai.connect(depositor).approve(this.L1_Pool.address, sumOfDeposits);
        await Promise.all(deposits.map((deposit) => this.L1_Pool.connect(depositor).deposit(deposit)));
      }

      const deposits = parseDeposits([1000,2000,5000, 3000,4000,5000]);

      await makeDeposits(depositor1, deposits.slice(0,3));

      expect(await this.L1_Pool.balanceOf(depositor1.address)).to.equal(parseEther('8000'));
      expect(await this.mockDai.balanceOf(depositor1.address)).to.equal(parseEther("9992000"));

      await makeDeposits(depositor2, deposits.slice(3,6));

      expect(await this.L1_Pool.balanceOf(depositor2.address)).to.equal(parseEther('12000'));
      expect(await this.mockDai.balanceOf(depositor2.address)).to.equal(parseEther("9988000"));

      expect(await this.mockYearnVault.totalAssets()).to.equal(
        deposits.reduce(
        (sum, deposit) => sum.add(deposit), parseEther('0')) // 20,000 - this should be curvetokens
       );

      /**
       * many moons later, the underlying has doubled!
       */
      this.mockYearnVault.setTotalAssets(parseEther("40000"));

      let balanceBefore = await this.mockDai.balanceOf(depositor1.address);
      await this.L1_Pool.connect(depositor1).withdraw(parseEther("1000"));
      let balanceAfter = await this.mockDai.balanceOf(depositor1.address);

      expect(await this.L1_Pool.balanceOf(depositor1.address)).to.equal(parseEther("7000"));
      expect(balanceAfter.sub(balanceBefore)).to.equal(parseEther("1997.999999999999999995"));

      balanceBefore = await this.mockDai.balanceOf(depositor2.address);
      await this.L1_Pool.connect(depositor2).withdraw(parseEther("10000"));
      balanceAfter = await this.mockDai.balanceOf(depositor2.address);

      expect(await this.L1_Pool.balanceOf(depositor2.address)).to.equal(parseEther("2000"));
      expect(balanceAfter.sub(balanceBefore)).to.equal(parseEther("19979.999999999999980019"));

      balanceBefore = await this.mockDai.balanceOf(depositor1.address);
      await this.L1_Pool.connect(depositor1).withdraw(parseEther("7000"));
      balanceAfter = await this.mockDai.balanceOf(depositor1.address);

      expect(await this.L1_Pool.balanceOf(depositor1.address)).to.equal(parseEther("0"));
      expect(balanceAfter.sub(balanceBefore)).to.equal(parseEther("13986.000000000000001556"));
    });
  });

  describe("calculating L1_Pool token value", async function () {
    it("calculated value is same as realized withdrawal amount", async function () {
      const amount = parseEther("20000");
      await this.mockDai.connect(depositor).approve(this.L1_Pool.address, amount);
      await this.L1_Pool.connect(depositor).deposit(amount);
      await expect(await this.L1_Pool.connect(depositor).withdraw(parseEther("10000"))).to
        .emit(this.L1_Pool, "Withdrawal").withArgs(
          depositor.address,
          parseEther("9990")
        );
      expect(await this.L1_Pool.connect(depositor).valueFor(parseEther("10000"))).to.equal(parseEther("9990"));
    });

    it("calculating value for a single L1_Pool token", async function () {
      const amount = parseEther("10000");
      await this.mockDai.connect(depositor).approve(this.L1_Pool.address, amount);
      await this.L1_Pool.connect(depositor).deposit(amount);

      const valueForOneShare = await this.L1_Pool.valueFor(parseEther("1"));
      const L1_PoolTokenValue = await this.L1_Pool.poolTokenValue();
      expect(L1_PoolTokenValue).to.equal(parseEther("0.999"));
      expect(valueForOneShare).to.equal(L1_PoolTokenValue);
    });

    it("value for a single L1_Pool token increases when value of underlying increases", async function () {
      const amount = parseEther("10000000");
      await this.mockDai.connect(depositor).approve(this.L1_Pool.address, amount);
      await this.L1_Pool.connect(depositor).deposit(amount);
 
      const valueForOneShare = await this.L1_Pool.valueFor(parseEther("1"));
      const L1_PoolTokenValue = await this.L1_Pool.poolTokenValue();
      expect(L1_PoolTokenValue).to.equal(parseEther("0.999"));
      expect(valueForOneShare).to.equal(L1_PoolTokenValue);

      this.mockYearnVault.setTotalAssets(parseEther("20000000"));
      expect(await this.L1_Pool.valueFor(parseEther("1"))).to.equal(parseEther("1.998"));
    });
  });

});