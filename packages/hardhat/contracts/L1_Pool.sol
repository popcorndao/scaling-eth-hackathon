
// SPDX-License-Identifier: MIT
// @unsupported: ovm

pragma solidity >=0.7.0 <0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "hardhat/console.sol";

/* Library Imports */
import { OVM_CrossDomainEnabled } from "@eth-optimism/contracts/libraries/bridge/OVM_CrossDomainEnabled.sol";


interface CrvLPToken is IERC20 {}

interface YearnVault is IERC20 {
  function token() external view returns (address);
  function deposit(uint256 amount) external returns (uint256);
  function withdraw(uint256 amount) external returns (uint256);
  function pricePerShare() external view returns (uint256);
}

interface CurveAddressProvider {
  function get_registry() external view returns (address);
}

interface CurveRegistry {
  function get_pool_from_lp_token(address lp_token) external view returns (address);
}

interface CurveDepositZap {
  function add_liquidity(uint256[4] calldata amounts, uint256 min_mint_amounts) external returns (uint256);
  function remove_liquidity_one_coin(uint256 amount, int128 i, uint256 min_underlying_amount) external returns (uint256);
  function calc_withdraw_one_coin(uint256 amount, int128 i) external view returns (uint256);
}

interface OVM_L1ERC20Gateway {
  function depositTo(address _address, uint256 amount) external;
}

interface PoolTokenEscrow {}

/**
* todo: create PoolTokenEscrow contract 
* todo: test _reportReceiptToL2Pool
*/
contract L1_Pool is ERC20, Ownable, OVM_CrossDomainEnabled, ReentrancyGuard {

  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using SafeERC20 for CrvLPToken;
  using SafeERC20 for YearnVault;

  IERC20 public dai;
  CrvLPToken public crvLPToken;
  YearnVault public yearnVault;
  CurveDepositZap public curveDepositZap;
  OVM_L1ERC20Gateway public L1_ERC20Gateway;
  PoolTokenEscrow public poolTokenEscrow;

  address public rewardsManager;

  address public L2_Pool;
  uint256 public pendingDeposits;
  uint256 constant BPS_DENOMINATOR = 10_000;
  uint256 constant SECONDS_PER_YEAR = 31_556_952;
  uint256 public withdrawalFee = 50;
  uint256 public managementFee = 200;
  uint256 public performanceFee = 2000;
  uint256 public poolTokenHWM = 1e18;
  uint256 public feesUpdatedAt;


  event Deposit(address indexed from, uint256 deposit, uint256 poolTokens);
  event Withdrawal(address indexed to, uint256 amount);
  event WithdrawalFee(address indexed to, uint256 amount);
  event PerformanceFee(uint256 amount);
  event ManagementFee(uint256 amount);
  event WithdrawalFeeChanged(uint256 previousBps, uint256 newBps);
  event ManagementFeeChanged(uint256 previousBps, uint256 newBps);
  event PerformanceFeeChanged(uint256 previousBps, uint256 newBps);

  constructor(
    IERC20 dai_,
    YearnVault yearnVault_,
    CurveDepositZap curveDepositZap_,
    address l1CrossDomainMessenger_,
    OVM_L1ERC20Gateway l1Erc20Gateway_,
    address rewardsManager_,
    PoolTokenEscrow poolTokenEscrow_
  ) ERC20("Popcorn DAI L1_YieldOptimizerPool", "L1_popDAI_LP")
    OVM_CrossDomainEnabled(l1CrossDomainMessenger_) {
    dai = dai_;
    yearnVault = yearnVault_;
    crvLPToken = CrvLPToken(yearnVault.token());
    curveDepositZap = curveDepositZap_;
    L1_ERC20Gateway = l1Erc20Gateway_;
    rewardsManager = rewardsManager_;
    poolTokenEscrow = poolTokenEscrow_;
    feesUpdatedAt = block.timestamp;
  }

  function setL2Pool(address address_) public onlyOwner {
    L2_Pool = address_;
  }

  /**
  * this function will deposit the DAI balance held by this contract into a yield optimizing strategy.
  * this assumes that an L2 withdrawal (moving DAI from L2 to L1) has been made and sent to this contract
  */
  function deposit() public returns (uint256) {
    _takeFees();

    uint256 currentBalance = dai.balanceOf(address(this));
    require(currentBalance > 0, "not enough balance");

    uint256 poolTokens = _issuePoolTokens(address(poolTokenEscrow), currentBalance);
    emit Deposit(msg.sender, currentBalance, poolTokens);
    
    uint256 crvLPTokenAmount = _sendToCurve(currentBalance);
    _sendToYearn(crvLPTokenAmount);
    _reportPoolTokenHWM();
    
    return balanceOf(address(poolTokenEscrow));

  }

  function withdraw(uint256 amount, address address_, bytes32 batchId)
    external
    onlyFromCrossDomainAccount(L2_Pool)
    returns (uint256, uint256)
  {
    require(amount <= balanceOf(address(poolTokenEscrow)), "Insufficient pool token balance");
    _takeFees();

    uint256 daiAmount = _withdrawPoolTokens(address(poolTokenEscrow), amount);
    uint256 fee = _calculateWithdrawalFee(daiAmount);
    uint256 withdrawal = daiAmount.sub(fee);

    _transferWithdrawalFee(fee);
    _transferWithdrawal(address_, withdrawal);
    _reportReceiptToL2Pool(batchId, withdrawal);

    _reportPoolTokenHWM();
    return (withdrawal, fee);
  }

  function _reportReceiptToL2Pool(bytes32 batchId, uint256 daiAmount) internal {
     bytes memory data =
      abi.encodeWithSignature(
      "_batchWithdrawalRequestReceived(bytes32,uint256)",
        batchId,
        daiAmount
      );

    sendCrossDomainMessage(
        address(L2_Pool),
        data,
        8900000
    );
  }

  function takeFees() nonReentrant external {
    _takeFees();
    _reportPoolTokenHWM();
  }

  function setWithdrawalFee(uint256 withdrawalFee_) external onlyOwner {
    require(withdrawalFee != withdrawalFee_, "Same withdrawalFee");
    uint256 _previousWithdrawalFee = withdrawalFee;
    withdrawalFee = withdrawalFee_;
    emit WithdrawalFeeChanged(_previousWithdrawalFee, withdrawalFee);
  }

  function setManagementFee(uint256 managementFee_) external onlyOwner {
    require(managementFee != managementFee_, "Same managementFee");
    uint256 _previousManagementFee = managementFee;
    managementFee = managementFee_;
    emit ManagementFeeChanged(_previousManagementFee, managementFee);
  }

  function setPerformanceFee(uint256 performanceFee_) external onlyOwner {
    require(performanceFee != performanceFee_, "Same performanceFee");
    uint256 _previousPerformanceFee = performanceFee;
    performanceFee = performanceFee_;
    emit PerformanceFeeChanged(_previousPerformanceFee, performanceFee);
  }

  function withdrawAccruedFees() external onlyOwner {
    uint256 tokenBalance = balanceOf(address(this));
    uint256 daiAmount = _withdrawPoolTokens(address(this), tokenBalance);
    _transferDai(rewardsManager, daiAmount);
  }

  function pricePerPoolToken() public view returns (uint256) {
    return valueFor(10**decimals());
  }

  function totalValue() public view returns (uint256) {
    return _totalValue();
  }
  function valueFor(uint256 poolTokens) public view returns (uint256) {
    uint256 yvShares = _yearnSharesFor(poolTokens);
    uint256 shareValue = _yearnShareValue(yvShares);
    uint256 fee = _calculateWithdrawalFee(shareValue);
    return shareValue.sub(fee);
  }


  function _totalValue() internal view returns (uint256) {
    uint256 yvShareBalance = yearnVault.balanceOf(address(this));
    return _yearnShareValue(yvShareBalance);
  }

  function _reportPoolTokenHWM() internal {
    if (pricePerPoolToken() > poolTokenHWM) {
      poolTokenHWM = pricePerPoolToken();
    }
  }

  function _issueTokensForFeeAmount(uint256 amount) internal {
    uint256 tokens = amount.mul(pricePerPoolToken()).div(10**decimals());
    _issuePoolTokens(address(this), tokens);
  }

  function _takeManagementFee() internal {
    uint256 period = block.timestamp.sub(feesUpdatedAt);
    uint256 fee =
      (managementFee.mul(totalValue()).mul(period)).div(
        SECONDS_PER_YEAR.mul(BPS_DENOMINATOR)
      );
      if (fee > 0) {
        _issueTokensForFeeAmount(fee);
        emit ManagementFee(fee);
      }
  }

  function _takePerformanceFee() internal {
    int256 gain = int256(pricePerPoolToken() - poolTokenHWM);
    if (gain > 0) {
      uint256 changeInPricePerToken = uint256(gain);
      uint256 fee =
        performanceFee
          .mul(changeInPricePerToken)
          .mul(totalSupply())
          .div(BPS_DENOMINATOR)
          .div(1e18);
      _issueTokensForFeeAmount(fee);
      emit PerformanceFee(fee);
    }
  }

  function _takeFees() internal {
    _takeManagementFee();
    _takePerformanceFee();
    feesUpdatedAt = block.timestamp;
  }

  function _calculateWithdrawalFee(uint256 withdrawalAmount)
    internal
    view
    returns (uint256)
  {
    return withdrawalAmount.mul(withdrawalFee).div(BPS_DENOMINATOR);
  }

  function _transferWithdrawalFee(uint256 fee) internal {
    _transferDai(rewardsManager, fee);
    emit WithdrawalFee(rewardsManager, fee);
  }

  function _transferWithdrawal(address address_, uint256 amount) internal {
    dai.approve(address(L1_ERC20Gateway), amount);
    L1_ERC20Gateway.depositTo(address_, amount);
  }

  function _transferDai(address to, uint256 amount) internal {
    dai.safeApprove(address(this), amount);
    dai.safeTransferFrom(address(this), to, amount);
  }

  function _poolShareFor(uint256 poolTokenAmount)
    internal
    view
    returns (uint256)
  {
    if (totalSupply() == 0) {
      return 1e18;
    }
    return poolTokenAmount.mul(1e18).div(totalSupply());
  }

  function _issuePoolTokens(address to, uint256 amount)
    internal
    returns (uint256)
  {
    _mint(to, amount);
    return amount;
  }


  function _burnPoolTokens(address from, uint256 amount) internal returns (uint256 burnedAmount) {
    _burn(from, amount);
    return amount;
  }

  function _withdrawPoolTokens(address fromAddress, uint256 amount)
    internal
    returns (uint256)
  {
    uint256 yvShareWithdrawal = _yearnSharesFor(amount);
    _burnPoolTokens(fromAddress, amount);
    uint256 crvLPTokenAmount = _withdrawFromYearn(yvShareWithdrawal);
    return _withdrawFromCurve(crvLPTokenAmount);
  }

  function _sendToCurve(uint256 amount) internal returns (uint256) {
    dai.safeApprove(address(curveDepositZap), amount);
    uint256[4] memory curveDepositAmounts =
      [
        0, // USDX
        amount, // DAI
        0, // USDC
        0 // USDT
      ];
    return curveDepositZap.add_liquidity(curveDepositAmounts, 0);
  }


  function _crvBalance() internal view returns (uint256) {
    return crvLPToken.balanceOf(address(this));
  }

  function _withdrawFromCurve(uint256 crvLPTokenAmount)
    internal
    returns (uint256)
  {
    crvLPToken.safeApprove(address(curveDepositZap), crvLPTokenAmount);
    return curveDepositZap.remove_liquidity_one_coin(crvLPTokenAmount, 1, 0);
  }

  function _sendToYearn(uint256 amount) internal returns (uint256) {
    crvLPToken.safeApprove(address(yearnVault), amount);
    uint256 yearnBalanceBefore = _yearnBalance();
    yearnVault.deposit(amount);
    uint256 yearnBalanceAfter = _yearnBalance();
    return yearnBalanceAfter.sub(yearnBalanceBefore);
  }

  function _yearnBalance() internal view returns (uint256) {
    return yearnVault.balanceOf(address(this));
  }

  function _yearnSharesFor(uint256 poolTokenAmount)
    internal
    view
    returns (uint256)
  {
    return
      _yearnBalance().mul(_poolShareFor(poolTokenAmount)).div(1e18);
  }

  function _withdrawFromYearn(uint256 yvShares) internal returns (uint256) {
    uint256 crvBalanceBefore = _crvBalance();
    yearnVault.withdraw(yvShares);
    uint256 crvBalanceAfter = _crvBalance();
    return crvBalanceAfter.sub(crvBalanceBefore);
  }

  function _yearnShareValue(uint256 yvShares) internal view returns (uint256) {
    uint256 crvLPTokens = yearnVault.pricePerShare() * yvShares / 1e18;
    return curveDepositZap.calc_withdraw_one_coin(crvLPTokens, 1);
  }
}
