import { Watcher } from "@eth-optimism/watcher";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";
import { useEthers } from "@usedapp/core";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import env from "react-dotenv";
import BridgeInterface from "src/components/BridgeInterface";
import Navbar from "src/components/Navbar";
import SwitchNetworkAlert from "src/components/SwitchNetworkAlert";
import TokenInput from "src/components/TokenInput";
import type { TokenBalances } from "src/interfaces/interfaces";
import approveSpending from "src/utils/approveSpending";
import watchCrossChainMessage from "src/utils/watchCrossChainMessage";
import mockERC20 from "../abi/ERC20.json";
import mockL2ERC20 from "../abi/L2DepositedERC20.json";
import l2_Pool from "../abi/L2_Pool.json";

// L1 messenger address depends on the deployment, this is default for our local deployment.
const l1MessengerAddress = "0x59b670e9fA9D0A427751Af201D676719a970857b";
// L2 messenger address is always the same.
const l2MessengerAddress = "0x4200000000000000000000000000000000000007";

export default function Layer2(): JSX.Element {
  const { account, chainId, library } = useEthers();
  const [l1Dai, setL1Dai] = useState<Contract>();
  const [l2Dai, setL2Dai] = useState<Contract>();
  const [l2Pool, setL2Pool] = useState<Contract>();
  const [watcher, setWatcher] = useState<any>();
  const [balances, setBalances] = useState<TokenBalances>();
  const [l2PoolAllowance, setL2PoolAllowance] = useState<number>(0);
  const [wait, setWait] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [networkAlert, setNetworkAlert] = useState<"layer1" | "layer2" | null>(
    null
  );
  const l1Provider = new JsonRpcProvider("http://localhost:9545");

  useEffect(() => {
    if (chainId === undefined) {
      return;
    }
    if (chainId !== 420) {
      setNetworkAlert("layer2");
    }
  }, [chainId]);

  useEffect(() => {
    if (chainId !== 420 || !account) {
      return;
    }
    setWatcher(
      new Watcher({
        l1: {
          provider: l1Provider,
          messengerAddress: l1MessengerAddress,
        },
        l2: {
          provider: library,
          messengerAddress: l2MessengerAddress,
        },
      })
    );
    //Run example.js in hardhat first and include the printed addresses
    setL1Dai(
      new Contract(
        env.L1_DAI_ADDRESS,
        mockERC20.abi,
        l1Provider?.getSigner()
      )
    );
    setL2Dai(
      new Contract(
        env.L2_DAI_ADDRESS,
        mockL2ERC20.abi,
        library?.getSigner()
      )
    );
    setL2Pool(
      new Contract(
        env.L2_POOL_ADDRESS,
        l2_Pool.abi,
        library?.getSigner()
      )
    );
  }, [account, chainId]);

  useEffect(() => {
    if (account && l1Dai && l2Dai && l2Pool && chainId === 420) {
      l1Dai.balanceOf(account).then((res) =>
        setBalances((prevState) => ({
          ...prevState,
          l1Dai: Number(res.toString()),
        }))
      );
      l2Dai.balanceOf(account).then((res) =>
        setBalances((prevState) => ({
          ...prevState,
          l2Dai: Number(res.toString()),
        }))
      );
      l2Dai
        .allowance(account, l2Pool.address)
        .then((res) => setL2PoolAllowance(Number(res.toString())));
      l2Pool.balanceOf(account).then((res) =>
        setBalances((prevState) => ({
          ...prevState,
          l2PoolShare: Number(res.toString()),
        }))
      );
    }
  }, [account, l1Dai, l2Dai, l2Pool, chainId, wait]);

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
    setNetworkAlert("layer1");
  }

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
        title="Token Bridge L2"
        infoText="ATTENTION! Always reset your account if you have send transactions on
        L2. Metamask gets irritated with the Nonces in local for some reason."
        balances={balances}
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
          <TokenInput
            label="L2 to L1"
            availableToken={balances?.l2Dai}
            handleClick={moveFundsFromL2ToL1}
            disabled={balances?.l2Dai === 0 || wait || !account}
            waiting={wait}
          />
        </>
      </BridgeInterface>
    </div>
  );
}
