// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Mock_OVM_L2DepositedERC20 is ERC20 {
  constructor(string memory name_, string memory symbol_)
  ERC20(name_, symbol_) {

  }

  function withdrawTo(address to_, uint256 amount_) public {
    _transfer(msg.sender, to_, amount_);
  }

  function mint(address to_, uint256 amount_) public {
    _mint(to_, amount_);
  }

  function burn(address from_, uint256 amount_) public {
    _burn(from_, amount_);
  }
}