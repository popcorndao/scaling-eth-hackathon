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

export default function Bridge(): JSX.Element {
  const { account, chainId } = useEthers();
  const [l1Dai, l2Dai, l2Pool, l1TokenGateway] = useContracts();
  const [watcher] = useWatcher();
  const balances = useDaiBalances();
  const [l1Allowance, setL1Allowance] = useState<number>(0);
  const [wait, setWait] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [networkAlert, setNetworkAlert] = useState<boolean>(
    null
  );

  useEffect(() => {
    if (typeof chainId === "number" && (chainId !== 31337 || chainId !== 420)) {
      setNetworkAlert(true);
    }
  }, [chainId]);

  useEffect(() => {
    if (account && l1Dai) {
      l1Dai
        .allowance(account, l1TokenGateway.address)
        .then((res) => setL1Allowance(Number(res.toString())));
    }
  }, [account, l1Dai, wait]);

  useEffect(() => {
    if (error) {
      setTimeout(() => setError(null), 5000);
    }
  }, [error]);

  async function moveFundsFromL1ToL2(amount: number): Promise<void> {
    setWait(true);
    if (amount > balances.l1Dai) {
      setError("You dont have enough Dai for this.");
      setWait(false);
      return;
    }
    if (l1Allowance < amount) {
      await approveSpending(
        l1Dai,
        "Token Gateway",
        l1TokenGateway.address,
        setWait
      );
    }
    const depositTx = await l1TokenGateway
      .deposit(amount)
      .catch((err) => console.log(err));
    await watchCrossChainMessage(
      depositTx,
      {
        loading: "Depositing Dai in L2...",
        success: "Deposit Success",
        error: "Deposit Error",
      },
      watcher,
      "L2"
    );
    setWait(false);
  }

  async function moveFundsFromL2ToL1(amount: number) {
    setWait(true);
    if (amount > balances.l2Dai) {
      setError("You dont have enough Dai for this.");
      setWait(false);
      return;
    }
    const withdrawTx = await l2Dai.withdraw(amount, {
      gasLimit: 800000,
      gasPrice: 0,
    });
    await watchCrossChainMessage(
      withdrawTx,
      {
        loading: "Withdrawing Dai to L1...",
        success: "Withdraw Success",
        error: "Withdraw Error",
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
          {chainId === 31337 ? (
            <TokenInput
              label="L1 to L2"
              availableToken={balances?.l1Dai}
              handleClick={moveFundsFromL1ToL2}
              disabled={balances?.l1Dai === 0 || wait || !account}
              waiting={wait}
            />
          ) : (
            <TokenInput
              label="L2 to L1"
              availableToken={balances?.l2Dai}
              handleClick={moveFundsFromL2ToL1}
              disabled={balances?.l2Dai === 0 || wait || !account}
              waiting={wait}
            />
          )}
        </>
      </BridgeInterface>
    </div>
  );
}
