import { BigNumber } from "@ethersproject/bignumber";
import { BatchWithdrawablePool } from "../typechain/BatchWithdrawablePool";

enum TransferStatus {
  Pending,
  InTransit,
  Completed
}

type TransferStatuses =  "Pending" | "InTransit" | "Completed";

const TransferStatusMap: {[key: number]: TransferStatuses} = {
  [TransferStatus.Pending]: "Pending",
  [TransferStatus.InTransit]: "InTransit",
  [TransferStatus.Completed]: "Completed"
}


interface AddressWithdrawal {
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
        claimed: unclaimedShares.eq(0) && claimable,
        tokensToReceive: unclaimedShares.mul(vault.tokenBalance).div(vault.unclaimedShares),
        transferStatus: TransferStatusMap[vault.transferStatus]
      }
    }));
  }
}

export default BatchWithdrawablePoolAdapter;