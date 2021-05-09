
// SPDX-License-Identifier: MIT

pragma solidity >0.5.0 <0.8.4;
pragma experimental ABIEncoderV2;

import "./L2DepositedERC20.sol";
import "./BatchWithdrawablePool.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/* Library Imports */
import { OVM_CrossDomainEnabled } from "@eth-optimism/contracts/libraries/bridge/OVM_CrossDomainEnabled.sol";


/**
* todo: create BatchDepositablePool with deposit receipts
* todo: user secure ERC20 contract
*/
contract L2_Pool is ERC20, OVM_CrossDomainEnabled, BatchWithdrawablePool {

  using SafeMath for uint256;

  L2DepositedERC20 public oDAI;
  address public L1_Pool;
  
  uint256 public toDeposit;
  uint256 public batchTransferPeriod;
  uint256 public lastDepositMadeAt;

  event Deposit(address from, uint256 deposit, uint256 poolTokens);

  constructor(
    L2DepositedERC20 _oDAI,
    address _L1_Pool,
    address _L2_CrossDomainMessenger,
    uint256 _batchTransferPeriod
  ) OVM_CrossDomainEnabled(_L2_CrossDomainMessenger)
    ERC20(0, "Popcorn DAI L2 YieldOptimizerPool")  
    BatchWithdrawablePool(_L1_Pool, _batchTransferPeriod) {
    batchTransferPeriod = _batchTransferPeriod;
    oDAI = _oDAI;
    L1_Pool = _L1_Pool;
    lastDepositMadeAt = block.timestamp;
  }

  function deposit(uint256 amount) external returns (uint256) {
    require(oDAI.balanceOf(msg.sender) >= amount, "not enough DAI");

    uint256 poolTokens = _issuePoolTokens(msg.sender, amount);
    emit Deposit(msg.sender, amount, poolTokens);

    // todo: set timelock for withdrawal

    oDAI.transferFrom(msg.sender, address(this), amount);
    toDeposit = toDeposit.add(amount);

    if (batchDepositAllowed()) {
      executeBatchDeposit();
    }

    return this.balanceOf(msg.sender);
  }

  function batchDepositAllowed() public returns (bool) {
    return block.timestamp.sub(lastDepositMadeAt) >= batchTransferPeriod;
  }

  function executeBatchDeposit() public returns (uint256) {
    require(toDeposit > 0, "not enough to deposit");
    require(batchDepositAllowed(), "batch deposit not yet allowed");
    
    // mint POP tokens to incentivize calling this function

    oDAI.withdrawTo(L1_Pool, toDeposit); 
    toDeposit = 0;

    // this is included for convenience. in production, the layer 1 deposit function will be called by a keeper
    bytes memory data = abi.encodeWithSignature("deposit()");

    sendCrossDomainMessage(
        address(L1_Pool),
        data,
        8900000
    );

    lastDepositMadeAt = block.timestamp;

    return toDeposit;

  }

  /**
  * user can request an amount of shares to be redeemed by the L1_Pool and subsequently withdrawn from the L1_Pool
  * withdrawal requests are batched in order to avoid L1 gas fees to end users
  **/
  function requestWithdrawal(uint256 amount) public returns (uint256) {

    //  todo: check if timelock has expired
    require(amount <= this.balanceOf(msg.sender), "request exceeds balance");
    _burnPoolTokens(msg.sender, amount);
    _pushWithdrawalRequest(amount);

    if (batchWithdrawalAllowed()) {
      executeBatchWithdrawal();
    }
    
    return amount;

  }

  function claimWithdrawal(bytes32 batchId) public returns (uint256) {
    uint256 tokensToReceive = _claimWithdrawal(batchId);  
    oDAI.transfer(msg.sender, tokensToReceive);
    return tokensToReceive;
  }

  function _burnPoolTokens(address from, uint256 amount) internal returns (uint256 burnedAmount) {
    _burn(from, amount);
    return amount;
  }

  function _issuePoolTokens(address to, uint256 amount) internal returns (uint256 issuedAmount) {
    _mint(to, amount);
    return amount;
  }
}
