import { useEthers } from "@usedapp/core";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import Navbar from "src/components/Navbar";
import SwitchNetworkAlert from "src/components/SwitchNetworkAlert";
import TokenInput from "src/components/TokenInput";
import approveSpending from "src/utils/approveSpending";
import useContracts from "src/utils/useContracts";
import useDaiBalances from "src/utils/useDaiBalances";
import useWatcher from "src/utils/useWatcher";
import watchCrossChainMessage from "src/utils/watchCrossChainMessage";

export default function Pool(): JSX.Element {
  const { account, chainId } = useEthers();
  const [l1Dai, l2Dai, l2Pool, l1TokenGateway] = useContracts();
  const [watcher] = useWatcher();
  const [wait, setWait] = useState<boolean>(false);
  const balances = useDaiBalances();
  const [l2PoolAllowance, setL2PoolAllowance] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [networkAlert, setNetworkAlert] = useState<boolean>(null);

  useEffect(() => {
    if (typeof chainId === "number" && chainId !== 31337 && chainId !== 420) {
      setNetworkAlert(true);
    }
  }, [chainId]);

  useEffect(() => {
    if (account && l2Dai) {
      l2Dai
        .allowance(account, l2Pool.address)
        .then((res) => setL2PoolAllowance(Number(res.toString())));
    }
  }, [account, l2Dai, wait]);

  useEffect(() => {
    if (error) {
      setTimeout(() => setError(null), 5000);
    }
  }, [error]);

  async function investInPool(amount: number): Promise<void> {
    setWait(true);
    if (amount > balances.l2Dai) {
      setError("You dont have enough Dai to invest.");
      setWait(false);
      return;
    }
    if (l2PoolAllowance < amount) {
      await approveSpending(l2Dai, "L2 Pool", l2Pool.address, setWait, {
        gasLimit: 8900000,
        gasPrice: 0,
      });
    }
    const depositTx = await l2Pool.deposit(amount, {
      gasLimit: 8900000,
      gasPrice: 0,
    });
    await watchCrossChainMessage(
      depositTx,
      {
        loading: "Investing...",
        success: "Investing Success",
        error: "Investing Error",
      },
      watcher,
      "L1"
    );
    setWait(false);
  }

  async function withdrawFromPool(amount: number): Promise<void> {
    setWait(true);
    if (amount > balances.l2PoolShare) {
      setError("You dont have that much invested.");
      setWait(false);
      return;
    }
    const withdrawTx = await l2Pool.withdraw(amount, {
      gasLimit: 8900000,
      gasPrice: 0,
    });
    await watchCrossChainMessage(
      withdrawTx,
      {
        loading: "Withdrawing from Pool...",
        success: "Withdrawl Success",
        error: "Withdrawl Error",
      },
      watcher,
      "L1"
    );
    setWait(false);
  }

  return (
    <div className="bg-gray-100 w-screen h-screen text-gray-700 flex flex-col">
      <Navbar />
      <Toaster position="top-right" />
      <SwitchNetworkAlert
        networkAlert={networkAlert}
        setNetworkAlert={setNetworkAlert}
      />
      <div className="w-full mt-32 flex flex-col">
        <h1 className="text-center text-6xl font-black mb-16">Pool</h1>
        <div className="w-1/2 bg-white shadow-lg rounded-lg mx-auto">
          <div className="flex flex-row">
            <div className="flex flex-col w-1/2 bg-gradient-to-r from-blue-500 to-blue-700 text-white pl-8 py-8 pr-4 rounded-l-lg">
              <div>
                <p>
                  This strategy earns a yield through incentivized shorting and
                  through the interest earned by lending the ETH long position.
                  This Pool collateralizes an incentivized short position (sETH)
                  with sUSD, balanced by an equally weighted long position
                  (ETH).
                </p>
                <span className="flex flex-row items-baseline mt-4">
                  <h2 className="font-bold text-4xl">30% APY</h2>
                </span>
              </div>
            </div>
            <div className="flex flex-col w-1/2 px-8 pt-6 pb-8">
              <div className="mb-8">
                <span className="flex flex-row justify-between mb-1">
                  <h2 className="font-bold text-2xl">Invest</h2>
                  <p className="text-lg">{balances?.l2Dai ?? 0} oDai</p>
                </span>
                <TokenInput
                  label="Invest"
                  availableToken={balances?.l2Dai}
                  handleClick={investInPool}
                  disabled={balances?.l2Dai === 0 || wait || !account}
                  direction="row"
                  waiting={wait}
                />
              </div>
              <hr />
              <div className="mt-4">
                <span className="flex flex-row justify-between mb-1">
                  <h2 className="font-bold text-2xl">Withdraw</h2>
                  <p className="text-lg">
                    {balances?.l2PoolShare ?? 0} Pool Share
                  </p>
                </span>
                <TokenInput
                  label="Withdraw"
                  availableToken={balances?.l2PoolShare}
                  handleClick={withdrawFromPool}
                  disabled={balances?.l2PoolShare === 0 || wait || !account}
                  direction="row"
                  waiting={wait}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
