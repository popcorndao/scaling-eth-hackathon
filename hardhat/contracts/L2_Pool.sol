
// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "hardhat/console.sol";
/* Library Imports */
import { OVM_CrossDomainEnabled } from "@eth-optimism/contracts/libraries/bridge/OVM_CrossDomainEnabled.sol"


contract L2_Pool is ERC20, Ownable, OVM_CrossDomainEnabled {

  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 public L2_dai;
  address public L1_Pool;


  event Deposit(address from, uint256 deposit, uint256 poolTokens);
  event Withdrawal(address to, uint256 amount);

  constructor(
    IERC20 dai_,
    address L1Pool,
    address _l2CrossDomainMessenger
  ) OVM_CrossDomainEnabled(_l2CrossDomainMessenger) 
    ERC20("Popcorn DAI L1_Pool", "L1_popDAI")  {
    L2_dai = dai_;
    L1_Pool = L1Pool;
  }

  function deposit(uint256 amount) external returns (uint256) {
    require(L2_dai.balanceOf(msg.sender) >= amount, "not enough DAI");

    uint256 poolTokens = _issuePoolTokens(msg.sender, amount);
    emit Deposit(msg.sender, amount);

    L2_dai.withdrawTo(L1_Pool, amount);
    
    sendCrossDomainMessage(L1_Pool, 
      abi.encodeWithSignature(
        "deposit(uint256)",
        amount,
    ), 100000);

    return this.balanceOf(msg.sender);
  }

  function withdraw(uint256 amount) external returns (uint256 withdrawalAmount) {
    assert(amount <= this.balanceOf(msg.sender));
    _burnPoolTokens(msg.sender, amount);

    sendCrossDomainMessage(L1_Pool, 
      abi.encodeWithSignature(
        "withdraw(unit256,address)",
        amount,
        msg.sender
        )
    );

  }
}