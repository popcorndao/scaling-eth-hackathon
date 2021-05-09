import toast from "react-hot-toast";
import type { ToastMessage } from "src/interfaces/interfaces";

export default async function watchCrossChainMessage(
  transaction: any,
  toastMessages: ToastMessage,
  watcher: any,
  toChain: "L1" | "L2"
):Promise<void> {
  if (!transaction) return;
  const awaitTx = transaction.wait();
  toast.promise(
    awaitTx,
    toastMessages,
    {
      style: {
        minWidth: "250px",
      },
    }
  );
  await awaitTx;
  let msgHash
  let transactionReceipt
  if (toChain === "L1") {
    msgHash = await watcher.getMessageHashesFromL2Tx(transaction.hash);
    transactionReceipt = watcher.getL1TransactionReceipt(msgHash[0]);
  }

  if (toChain === "L2") {
    msgHash = await watcher.getMessageHashesFromL1Tx(transaction.hash);
    transactionReceipt = watcher.getL2TransactionReceipt(msgHash[0]);
  }
  toast.promise(
    transactionReceipt,
    {
      loading: `Waiting for ${toChain}`,
      success: `${toChain} Success`,
      error: `${toChain} Error`,
    },
    {
      style: {
        minWidth: "250px",
      },
    }
  );
  await transactionReceipt;
}
