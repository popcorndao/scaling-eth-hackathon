// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "./MockERC20.sol";

import "hardhat/console.sol";

contract MockYearnV2Vault is MockERC20 {

  MockERC20 public token;

  constructor(address token_)
    MockERC20("Mock crvUSDX yVault", "yvUSDX")
  {
    token = MockERC20(token_);
  }

  function totalAssets() external view returns (uint256) {
    return token.balanceOf(address(this));
  }

  function pricePerShare() external view returns (uint256) {
    return _shareValue(10 ** this.decimals());
  }

  function deposit(uint256 amount) external returns (uint256) {
    token.transferFrom(msg.sender, address(this), amount);
    return _issueSharesForAmount(msg.sender, amount);
  }

  function withdraw(uint256 amount) external returns (uint256) {
    uint256 tokenAmount = _shareValue(amount);
    _burn(msg.sender, amount);
    token.approve(address(this), tokenAmount);
    token.transferFrom(address(this), msg.sender, tokenAmount);
    return tokenAmount;
  }

  function _issueSharesForAmount(address to, uint256 amount) internal returns (uint256) {
    uint256 shares = 0;
    if(this.totalSupply() == 0) {
      shares = amount;
    } else {
      shares = amount * this.totalSupply() / this.totalAssets();
    }
    _mint(to, shares);
    return shares;
  }

  function _shareValue(uint256 shares) internal view returns (uint256)  {
    if (this.totalSupply() == 0) {
      return shares;
    }
    return shares * this.totalAssets() / this.totalSupply();
  }

  // Test helpers

  function setTotalAssets(uint256 totalAssets_) external {
    token.burn(address(this), token.balanceOf(address(this)));
    token.mint(address(this), totalAssets_);
  }

}