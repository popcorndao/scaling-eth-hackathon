// SPDX-License-Identifier: MIT

pragma solidity >0.5.0 <0.8.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

/* Library Imports */
import { OVM_CrossDomainEnabled } from "@eth-optimism/contracts/libraries/bridge/OVM_CrossDomainEnabled.sol";


abstract contract BatchWithdrawablePool is OVM_CrossDomainEnabled {
  using SafeMath for uint256;

  address public L1_Target;
  bytes32 public currentWithdrawalBatchId;

  enum TransferStatus {
    Pending,
    InTransit,
    Completed
  }

  struct WithdrawalVault {
    TransferStatus transferStatus;
    uint256 unclaimedShares;
    uint256 tokenBalance;
    mapping(address => uint256) shareBalances;
  }

  mapping(address => bytes32[]) public withdrawalBatchIds;
  mapping(bytes32 => WithdrawalVault) public withdrawalVaults;
  uint256 public lastWithdrawalMadeAt;

  event WithdrawalRequested(address who, uint256 amount);
  event WithdrawalClaimed(address who, uint256 shares, uint256 tokensToReceive);


  constructor(
    address _l1_target
  ) {
    L1_Target = _l1_target;
    lastWithdrawalMadeAt = block.timestamp;
    currentWithdrawalBatchId =  keccak256(abi.encodePacked(block.timestamp, msg.sender));
  }

  function getWithdrawalsForAddress(address _address) public view returns (bytes32[] memory) {
    return withdrawalBatchIds[_address];
  }

  function addressHasClaimableWithdrawal(address _address, bytes32 batchId) public view returns (bool) {
    return withdrawalVaults[batchId].shareBalances[_address] > 0 && withdrawalVaults[batchId].transferStatus == TransferStatus.Completed;
  }

  function getWithdrawableBalance(address _address, bytes32 batchId) public view returns (uint256) {
    return withdrawalVaults[batchId].shareBalances[_address];
  }

  function batchWithdrawalAllowed() public view returns (bool) {
    return block.timestamp.sub(lastWithdrawalMadeAt) >= 12 hours;
  }

  function executeBatchWithdrawal() public returns (uint256) {
    uint256 amountToWithdraw = withdrawalVaults[currentWithdrawalBatchId].unclaimedShares;
    require(amountToWithdraw > 0, "not enough to withdraw");
    require(batchWithdrawalAllowed(), "can not execute batch withdrawal yet");
    
    bytes memory data =
      abi.encodeWithSignature(
      "withdraw(uint256,address,bytes32)",
        amountToWithdraw,
        address(this),
        currentWithdrawalBatchId
      );

    sendCrossDomainMessage(
        L1_Target,
        data,
        8900000
    );

    _handlePostBatchWithdrawal();

    return amountToWithdraw;

  }

  function _generateNextWithdrawalBatchId() internal returns (bytes32) {
    currentWithdrawalBatchId = keccak256(abi.encodePacked(block.timestamp, currentWithdrawalBatchId));
    withdrawalVaults[currentWithdrawalBatchId].transferStatus = TransferStatus.Pending;
    return currentWithdrawalBatchId;
  }

  function _pushWithdrawalRequest(uint256 amount) internal {
    WithdrawalVault storage vault = withdrawalVaults[currentWithdrawalBatchId];
    vault.unclaimedShares = vault.unclaimedShares.add(amount);
    vault.shareBalances[msg.sender] = vault.shareBalances[msg.sender].add(amount);

    withdrawalBatchIds[msg.sender].push(currentWithdrawalBatchId);
    emit WithdrawalRequested(msg.sender, amount);
  }


  function _handlePostBatchWithdrawal() internal returns (bytes32) {
    lastWithdrawalMadeAt = block.timestamp;
    withdrawalVaults[currentWithdrawalBatchId].transferStatus = TransferStatus.InTransit;
    return _generateNextWithdrawalBatchId();
  }

  function _batchWithdrawalRequestReceived(bytes32 batchId, uint256 tokenBalance) external onlyFromCrossDomainAccount(L1_Target) {
    withdrawalVaults[batchId].transferStatus = TransferStatus.Completed;
    withdrawalVaults[batchId].tokenBalance = tokenBalance;
  }

  function _claimWithdrawal(bytes32 batchId) internal returns (uint256) {
    require(withdrawalVaults[batchId].transferStatus == TransferStatus.Completed, "cannot claim withdrawal yet");
    require(addressHasClaimableWithdrawal(msg.sender, batchId));
    
    uint256 sharesToRedeem = withdrawalVaults[batchId].shareBalances[msg.sender]; 
    uint256 tokensToReceive = _redeemSharesFromVault(batchId, sharesToRedeem);
    emit WithdrawalClaimed(msg.sender, sharesToRedeem, tokensToReceive);

    return tokensToReceive;
  }

  function _redeemSharesFromVault(bytes32 batchId, uint256 sharesToRedeem) internal returns (uint256) {
    WithdrawalVault storage vault = withdrawalVaults[batchId];

    uint256 tokenAmountToReceive = vault.tokenBalance.mul(sharesToRedeem).div(vault.unclaimedShares);

    // update vault
    vault.unclaimedShares = vault.unclaimedShares.sub(sharesToRedeem);
    vault.tokenBalance = vault.tokenBalance.sub(tokenAmountToReceive);
    vault.shareBalances[msg.sender] = 0;

    return tokenAmountToReceive;
  }


}
