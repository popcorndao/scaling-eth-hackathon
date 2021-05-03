import type { Contract } from "@ethersproject/contracts";
import type { Dispatch } from "react";
import toast from "react-hot-toast";

export default async function approveSpending(
  erc20: Contract,
  spender:string,
  spenderAddress: string,
  setWait: Dispatch<boolean>
): Promise<void> {
  const approvalTx = await erc20.approve(spenderAddress, 999999);
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
