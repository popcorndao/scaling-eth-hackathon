import type { BatchWithdrawablePool } from "@scaling-eth-hackathon/contracts/typechain/BatchWithdrawablePool";
import BatchWithdrawablePoolAdapter, {
  AddressWithdrawal,
} from "@scaling-eth-hackathon/contracts/utils/BatchWithdrawalablePoolAdapter";
import { useEthers } from "@usedapp/core";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import useContracts from "src/utils/useContracts";
import loading from "src/images/loading.png";

interface WithdrawalsTableProps {
  shouldRefresh: [boolean, Function];
}

export default function WithdrawalsTable({
  shouldRefresh: [refresh, setShouldRefresh],
}: WithdrawalsTableProps) {
  const { account } = useEthers();

  const [, , l2Pool] = useContracts();
  const [withdrawals, setWithdrawals] = useState<AddressWithdrawal[]>([]);
  const [wait, setWait] = useState<boolean>(false);
  const [
    waitingForWithdrawalConfirmation,
    setWaitingForWithdrawalConfirmation,
  ] = useState(false);

  const getWithdrawalSummaries = async () => {
    const pool = BatchWithdrawablePoolAdapter.fromContract(
      l2Pool as BatchWithdrawablePool
    );
    try {
      const withdrawals = await pool.getWithdrawalSummaries(account);
      console.log("withdrawals", withdrawals);
      setWithdrawals(withdrawals);
      if (
        withdrawals.find(
          (withdrawal) =>
            withdrawal.transferStatus !== "Completed" &&
            !waitingForWithdrawalConfirmation
        )
      ) {
        setWaitingForWithdrawalConfirmation(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const claimWithdrawal = async (batchId: string, amount) => {
    setWait(true);

    const withdrawalTx = await l2Pool.claimWithdrawal(batchId, {
      gasLimit: 8900000,
      gasPrice: 0,
    });
    const awaitTx = withdrawalTx.wait();
    toast.promise(
      awaitTx,
      {
        loading: `Claiming withdrawal ...`,
        success: `Successfully claimed ${amount} oDAI!`,
        error: "Error claiming withdrawal",
      },
      {
        style: {
          minWidth: "250px",
        },
      }
    );

    await awaitTx;
    setWait(false);
    setShouldRefresh(true);
  };
  const filteredWithdrawals = withdrawals.filter(
    (withdrawal) => !withdrawal.claimed
  );

  const pollWithdrawalSummaries = () => {
    const poll = setInterval(() => {
      getWithdrawalSummaries();
      if (
        !filteredWithdrawals.find(
          (withdrawal) => withdrawal.transferStatus !== "Completed"
        )
      ) {
        clearInterval(poll);
        setWaitingForWithdrawalConfirmation(false);
      }
    }, 1000);
  };

  useEffect(() => {
    if (waitingForWithdrawalConfirmation) {
      pollWithdrawalSummaries();
    }
  }, [waitingForWithdrawalConfirmation]);

  useEffect(() => {
    if (account && l2Pool) getWithdrawalSummaries();
  }, [l2Pool, refresh, wait]);

  if (!account || !filteredWithdrawals.length) {
    return <></>;
  }

  return (
    <div className="flex flex-col mt-32 flex flex-col  mx-auto">
      <div className="w-full -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8 ">
        <div className="pb-5 border-b border-gray-200 mb-8">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Your Withdrawals
          </h3>
        </div>

        <div className="align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    BatchId
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Unclaimed Shares
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    claimable?
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Tokens to Receive
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredWithdrawals.map((withdrawal, idx) => (
                  <tr
                    key={withdrawal.batchId}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {withdrawal.batchId.substr(withdrawal.batchId.length - 4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {withdrawal.unclaimedShares.toString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {withdrawal.claimable ? "Yes" : "Not Yet"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {withdrawal.transferStatus !== "Completed"
                        ? "Pending"
                        : withdrawal.tokensToReceive.toString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {withdrawal.claimable && (
                        <a
                          href="#"
                          onClick={() =>
                            claimWithdrawal(
                              withdrawal.batchId,
                              withdrawal.tokensToReceive.toString()
                            )
                          }
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Claim
                        </a>
                      )}
                      {!withdrawal.claimable &&
                      <img src={loading} alt="loading" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
