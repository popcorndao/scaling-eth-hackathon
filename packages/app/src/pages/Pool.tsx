import { useEthers } from "@usedapp/core";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import BridgeInterface from "src/components/BridgeInterface";
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
  const balances = useDaiBalances();
  const [l2PoolAllowance, setL2PoolAllowance] = useState<number>(0);
  const [wait, setWait] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [networkAlert, setNetworkAlert] = useState<boolean>(
    null
  );

  useEffect(() => {
    if (chainId === undefined) {
      return;
    }
    if (chainId !== 420) {
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
    <div className="bg-gray-800 w-screen h-screen text-white flex flex-col">
      <Navbar />
      <Toaster position="top-right" />
      <SwitchNetworkAlert
        networkAlert={networkAlert}
        setNetworkAlert={setNetworkAlert}
      />
      <BridgeInterface
        balances={balances}
        chain={chainId === 31337 ? "L1" : "L2"}
      >
        <>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <TokenInput
            label="Invest"
            availableToken={balances?.l2Dai}
            handleClick={investInPool}
            disabled={balances?.l2Dai === 0 || wait || !account}
            waiting={wait}
          />
          <TokenInput
            label="Withdraw"
            availableToken={balances?.l2Dai}
            handleClick={withdrawFromPool}
            disabled={balances?.l2PoolShare === 0 || wait || !account}
            waiting={wait}
          />
        </>
      </BridgeInterface>
    </div>
  );
}
