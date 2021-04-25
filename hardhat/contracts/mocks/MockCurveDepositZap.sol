// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "./MockERC20.sol";

import "hardhat/console.sol";

contract MockCurveDepositZap {

  MockERC20 lpToken;
  MockERC20 dai;
  uint256 withdrawalSlippageBps = 10;

  uint256 BPS_DENOMINATOR = 10000;

  constructor(address lpToken_, address dai_)  {
    lpToken = MockERC20(lpToken_);
    dai = MockERC20(dai_);
  }

  function add_liquidity(
    uint256[4] calldata amounts,
    uint256 min_mint_amounts
  ) external returns (uint256) {
    dai.transferFrom(msg.sender, address(this), amounts[1]);
    assert(amounts[1]  > min_mint_amounts);
    lpToken.mint(msg.sender, amounts[1]);
    return amounts[1];
  }

  function remove_liquidity_one_coin(
    uint256 amount,
    int128 i,
    uint256 min_underlying_amount
  ) external returns (uint256) {
    lpToken.transferFrom(msg.sender, address(this), amount);

    uint256 slippage = amount * withdrawalSlippageBps / 10000;
    uint256 transferOut = amount - slippage;

    dai.approve(address(this), transferOut);
    dai.mint(address(this), transferOut);
    dai.transferFrom(address(this), msg.sender, transferOut);
    return transferOut;
  }

  function calc_withdraw_one_coin(
    uint256 amount,
    int128 i
  ) external view returns (uint256) {
    uint256 slippage = amount * withdrawalSlippageBps / 10000;
    uint256 transferOut = amount - slippage;
    return transferOut;
  }

  // Test helpers

  function setWithdrawalSlippage(uint256 withdrawalSlippageBps_) external {
    withdrawalSlippageBps = withdrawalSlippageBps_;
  }

}