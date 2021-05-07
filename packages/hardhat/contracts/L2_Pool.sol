
// SPDX-License-Identifier: MIT

pragma solidity >0.5.0 <0.8.4;
pragma experimental ABIEncoderV2;

import "./L2DepositedERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/* Library Imports */
import { OVM_CrossDomainEnabled } from "@eth-optimism/contracts/libraries/bridge/OVM_CrossDomainEnabled.sol";


contract L2_Pool is ERC20, OVM_CrossDomainEnabled {

  using SafeMath for uint256;

  L2DepositedERC20 public oDAI;
  address public L1_Pool;

  struct LockedBalance {
    address _address;
    uint256 _balance;
    uint256 _lockedUntil;
  }
  mapping(address => LockedBalance[]) lockedBalances;
  uint256 constant LOCK_TIME = 1209600;

  event Deposit(address from, uint256 deposit, uint256 poolTokens);
  event Withdrawal(address to, uint256 amount);

  constructor(
    L2DepositedERC20 _oDAI,
    address _L1Pool,
    address _l2CrossDomainMessenger
  ) OVM_CrossDomainEnabled(_l2CrossDomainMessenger)
    ERC20(0, "Popcorn DAI L2_YieldOptimizerPool")  {
    oDAI = _oDAI;
    L1_Pool = _L1Pool;
  }

  function deposit(uint256 amount) external returns (uint256) {
    require(oDAI.balanceOf(msg.sender) >= amount, "not enough DAI");

    uint256 poolTokens = _issuePoolTokens(msg.sender, amount);
    emit Deposit(msg.sender, amount, poolTokens);

    lockedBalances[msg.sender].push(
      LockedBalance({
        _address: msg.sender,
        _balance: amount,
        _lockedUntil: block.timestamp.add(LOCK_TIME)
      })
    );

    oDAI.transferFrom(msg.sender, address(this), amount);
    oDAI.withdrawTo(L1_Pool, amount);

    bytes memory data = abi.encodeWithSignature("deposit()");

    sendCrossDomainMessage(
        address(L1_Pool),
        data,
        8900000
    );

    return this.balanceOf(msg.sender);
  }

  function withdraw(uint256 amount) external {
    require(amount <= this.balanceOf(msg.sender));
    require(amount <= getWithdrawableBalance());

    _clearWithdrawnFromLocked(_amount);
    _burnPoolTokens(msg.sender, amount);

    bytes memory data =
      abi.encodeWithSignature(
      "withdraw(uint256,address)",
        amount,
        msg.sender
      );

    sendCrossDomainMessage(
        address(L1_Pool),
        data,
        8900000
    );
  }

  function _clearWithdrawnFromLocked(uint256 _amount) internal {
    uint256 _currentTime = block.timestamp;
    for (uint8 i = 0; i < lockedBalances[msg.sender].length; i++) {
      LockedBalance memory _locked = lockedBalances[msg.sender][i];
      if (_locked._lockedUntil <= _currentTime) {
        if (_amount == _locked._balance) {
          delete lockedBalances[msg.sender][i];
          return;
        }
        if (_amount > _locked._balance) {
          _amount = _amount.sub(_locked._balance);
          delete lockedBalances[msg.sender][i];
          continue;
        }
        if (_amount < _locked._balance) {
          lockedBalances[msg.sender][i]._balance = _locked._balance.sub(
            _amount
          );
          return;
        }
      }
    }
  }

  function getWithdrawableBalance() public view override returns (uint256) {
    uint256 _withdrawable = 0;
    uint256 _currentTime = block.timestamp;
    for (uint8 i = 0; i < lockedBalances[msg.sender].length; i++) {
      LockedBalance memory _locked = lockedBalances[msg.sender][i];
      if (_locked._lockedUntil <= _currentTime) {
        _withdrawable = _withdrawable.add(_locked._balance);
      }
    }

    return _withdrawable;
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
