import type { Contract } from "@ethersproject/contracts";
import type { Dispatch } from "react";
import toast from "react-hot-toast";
import type { GasSettings } from "src/interfaces/interfaces";

export default async function approveSpending(
  erc20: Contract,
  spender: string,
  spenderAddress: string,
  setWait: Dispatch<boolean>,
  gasSettings?: GasSettings
): Promise<void> {
  const approvalTx = await erc20.approve(
    spenderAddress,
    999999,
    gasSettings ? gasSettings : null
  );
  const awaitApproval = approvalTx.wait();
  toast.promise(
    awaitApproval,
    {
      loading: `Approving ${spender}`,
      success: "Approved",
      error: "Error",
    },
    {
      style: {
        minWidth: "250px",
      },
    }
  );
  await awaitApproval;
  setWait(false);
}
