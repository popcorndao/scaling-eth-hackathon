
// SPDX-License-Identifier: MIT

pragma solidity >0.5.0 <0.8.4;
pragma experimental ABIEncoderV2;

import "./L2DepositedERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "hardhat/console.sol";
/* Library Imports */
import { OVM_CrossDomainEnabled } from "@eth-optimism/contracts/libraries/bridge/OVM_CrossDomainEnabled.sol";

interface iL1_Pool {
  function withdraw(uint256 amount, address _address) external returns (uint256);
}


contract L2_Pool is ERC20, OVM_CrossDomainEnabled {

  using SafeMath for uint256;

  L2DepositedERC20 public L2_dai;
  address public L1_Pool;


  event Deposit(address from, uint256 deposit, uint256 poolTokens);
  event Withdrawal(address to, uint256 amount);

  constructor(
    L2DepositedERC20 _dai,
    address _L1Pool,
    address _l2CrossDomainMessenger
  ) OVM_CrossDomainEnabled(_l2CrossDomainMessenger)
    ERC20(100000, "Popcorn DAI L1_Pool")  {
    L2_dai = _dai;
    L1_Pool = _L1Pool;
  }

  function deposit(uint256 amount) external returns (uint256) {
    require(L2_dai.balanceOf(msg.sender) >= amount, "not enough DAI");

    uint256 poolTokens = _issuePoolTokens(msg.sender, amount);
    emit Deposit(msg.sender, amount, poolTokens);
    // set timelock for withdrawal
    L2_dai.transferFrom(msg.sender, address(this), amount);
    L2_dai.withdrawTo(L1_Pool, amount);

    return this.balanceOf(msg.sender);
  }

  function withdraw(uint256 amount) external {
    // check if timelock has expired

    require(amount <= this.balanceOf(msg.sender));
    _burnPoolTokens(msg.sender, amount);

        bytes memory data =
          abi.encodeWithSignature(
          "withdraw(unit256,address)",
            amount,
            msg.sender
          );

        // Send message up to L1 gateway
        sendCrossDomainMessage(
            address(L1_Pool),
            data,
            8900000
        );
  }

    function increment(uint256 amount) external {
        bytes memory data =
          abi.encodeWithSelector(
          "increment(amount)",
            amount
          );

        // Send message up to L1 gateway
        sendCrossDomainMessage(
            address(L1_Pool),
            data,
            8900000
        );
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
