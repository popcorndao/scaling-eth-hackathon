import { useEthers } from "@usedapp/core";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import AvailableToken from "src/components/AvailableToken";
import ConnectWallet from "src/components/ConnectWallet";
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
  const [wait, setWait] = useState<boolean>(false);
  const balances = useDaiBalances(wait);
  const [l1Allowance, setL1Allowance] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [networkAlert, setNetworkAlert] = useState<boolean>(null);

  useEffect(() => {
    if (typeof chainId === "number" && chainId !== 31337 && chainId !== 420) {
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
    <div className="bg-gray-100 w-screen h-screen text-gray-700 flex flex-col">
      <Navbar />
      <Toaster position="top-right" />
      <SwitchNetworkAlert
        networkAlert={networkAlert}
        setNetworkAlert={setNetworkAlert}
      />
      {account ? (
        <div className="w-full mt-32 flex flex-col">
          <h1 className="text-center text-6xl font-black mb-16">Token Bridge</h1>
          <div className="flex flex-row w-7/12 mx-auto">
            {chainId === 31337 ? (
              <AvailableToken
                network="Mainnet"
                icon="/images/mainnet-icon.png"
                availableToken={balances?.l1Dai}
                tokenName="Dai"
              />
            ) : (
              <AvailableToken
                network="Optimism"
                icon="/images/optimism-icon.png"
                availableToken={balances?.l2Dai}
                tokenName="oDai"
              />
            )}
            <div className="w-1/2 mx-auto py-1">
              <div className="w-full bg-gray-200 flex flex-col h-full justify-center">
                {error && <p className="text-sm text-red-500">{error}</p>}
                {chainId === 31337 ? (
                  <TokenInput
                    label="Transfer"
                    tokenName="Dai"
                    availableToken={balances?.l1Dai}
                    handleClick={moveFundsFromL1ToL2}
                    disabled={balances?.l1Dai === 0 || wait}
                    direction="col"
                    waiting={wait}
                  />
                ) : (
                  <TokenInput
                    label="Transfer"
                    tokenName="Dai"
                    availableToken={balances?.l2Dai}
                    handleClick={moveFundsFromL2ToL1}
                    disabled={balances?.l2Dai === 0 || wait}
                    direction="col"
                    waiting={wait}
                  />
                )}
              </div>
            </div>
            {chainId === 31337 ? (
              <AvailableToken
                network="Optimism"
                icon="/images/optimism-icon.png"
                availableToken={balances?.l2Dai}
                tokenName="oDai"
              />
            ) : (
              <AvailableToken
                network="Mainnet"
                icon="/images/mainnet-icon.png"
                availableToken={balances?.l1Dai}
                tokenName="Dai"
              />
            )}
          </div>
          <p className="text-center mt-4">
            {chainId === 31337
              ? "Switch to Optimism if you want to move funds to Mainnet"
              : "Switch to Mainnet if you want to move funds to Optimism"}
          </p>
          <div className="w-full flex justify-center mt-16">
            <img
              className="inline mr-2 w-1/2 justify-center opacity-10"
              src="/images/bridge.png"
              alt="logo"
            />
          </div>
        </div>
      ) : (
        <ConnectWallet />
      )}
    </div>
  );
}
