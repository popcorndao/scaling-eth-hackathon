import { BigNumber } from "@ethersproject/bignumber";
import { parseEther } from "@ethersproject/units";
import { BatchWithdrawablePool } from "../typechain/BatchWithdrawablePool";

enum TransferStatus {
  Pending,
  InTransit,
  Completed
}

export type TransferStatuses =  "Pending" | "InTransit" | "Completed";

export const TransferStatusMap: {[key: number]: TransferStatuses} = {
  [TransferStatus.Pending]: "Pending",
  [TransferStatus.InTransit]: "InTransit",
  [TransferStatus.Completed]: "Completed"
}


export interface AddressWithdrawal {
  batchId: string;
  unclaimedShares: BigNumber;
  claimable: boolean;
  claimed: boolean;
  tokensToReceive: BigNumber;
  transferStatus: TransferStatuses;
}

export class BatchWithdrawablePoolAdapter {
  constructor(public contract: BatchWithdrawablePool) {
  
  }

  static fromContract(contract: BatchWithdrawablePool) {
    return new BatchWithdrawablePoolAdapter(contract);
  }

  async withdrawalVaults(batchId: string) {
    const vault = await this.contract.withdrawalVaults(batchId);
    return {
      unclaimedShares: vault.unclaimedShares,
      tokenBalance: vault.tokenBalance,
      transferStatus: TransferStatusMap[vault.transferStatus]
    }
  }

  async getWithdrawalSummaries(address: string): Promise<AddressWithdrawal[]> {
    const withdrawals = await this.contract.getWithdrawalsForAddress(address)

    return Promise.all(withdrawals.map(async (batchId) => {

      const unclaimedShares = await this.contract.getWithdrawableBalance(address, batchId);
      const claimable = await this.contract.addressHasClaimableWithdrawal(address, batchId);
      const vault = await this.contract.withdrawalVaults(batchId);

      return {
        batchId,
        unclaimedShares,
        claimable,
        claimed: unclaimedShares.eq(0),
        tokensToReceive: !vault.unclaimedShares.eq(0) ? 
          unclaimedShares.mul(vault.tokenBalance).div(vault.unclaimedShares) : 
          parseEther('0'),
        transferStatus: TransferStatusMap[vault.transferStatus]
      }
    }));
  }
}

export default BatchWithdrawablePoolAdapter;