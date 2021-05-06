import { Watcher } from "@eth-optimism/watcher";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";
import { useEthers } from "@usedapp/core";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import BridgeInterface from "src/components/BridgeInterface";
import Navbar from "src/components/Navbar";
import SwitchNetworkAlert from "src/components/SwitchNetworkAlert";
import TokenInput from "src/components/TokenInput";
import type { TokenBalances } from "src/interfaces/interfaces";
import approveSpending from "src/utils/approveSpending";
import watchCrossChainMessage from "src/utils/watchCrossChainMessage";
import mockERC20 from "../abi/ERC20.json";
import l1_ERC20Gateway from "../abi/iOVM_L1TokenGateway.json";
import mockL2ERC20 from "../abi/L2DepositedERC20.json";
import l2_Pool from "../abi/L2_Pool.json";

// L1 messenger address depends on the deployment, this is default for our local deployment.
const l1MessengerAddress = "0x59b670e9fA9D0A427751Af201D676719a970857b";
// L2 messenger address is always the same.
const l2MessengerAddress = "0x4200000000000000000000000000000000000007";

export default function Layer1(): JSX.Element {
  const { account, chainId, library } = useEthers();
  const [l1Dai, setL1Dai] = useState<Contract>();
  const [l2Dai, setL2Dai] = useState<Contract>();
  const [l2Pool, setL2Pool] = useState<Contract>();
  const [watcher, setWatcher] = useState<any>();
  const [balances, setBalances] = useState<TokenBalances>();
  const [l1TokenGateway, setL1TokenGateway] = useState<Contract>();
  const [l1Allowance, setL1Allowance] = useState<number>(0);
  const [wait, setWait] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [networkAlert, setNetworkAlert] = useState<"layer1" | "layer2" | null>(
    null
  );
  const l2Provider = new JsonRpcProvider("http://localhost:8545");

  useEffect(() => {
    if (chainId === undefined) {
      return;
    }
    if (chainId !== 31337) {
      setNetworkAlert("layer1");
    }
  }, [chainId]);

  useEffect(() => {
    setWatcher(
      new Watcher({
        l1: {
          provider: library,
          messengerAddress: l1MessengerAddress,
        },
        l2: {
          provider: l2Provider,
          messengerAddress: l2MessengerAddress,
        },
      })
    );
    //Run example.js in hardhat first and include the printed addresses
    setL1Dai(
      new Contract(process.env.REACT_APP_L1_DAI_ADDRESS, mockERC20.abi, library?.getSigner())
    );
    setL2Dai(
      new Contract(process.env.REACT_APP_L2_DAI_ADDRESS, mockL2ERC20.abi, l2Provider?.getSigner())
    );
    setL2Pool(
      new Contract(process.env.REACT_APP_L2_POOL_ADDRESS, l2_Pool.abi, l2Provider?.getSigner())
    );
    setL1TokenGateway(
      new Contract(
        process.env.REACT_APP_L1_TOKEN_GATEWAY_ADDRESS,
        l1_ERC20Gateway.abi,
        library?.getSigner()
      )
    );
  }, [account]);

  useEffect(() => {
    if (account && l1Dai && l2Dai && l2Pool) {
      l1Dai.balanceOf(account).then((res) =>
        setBalances((prevState) => ({
          ...prevState,
          l1Dai: Number(res.toString()),
        }))
      );
      l1Dai
        .allowance(account, l1TokenGateway.address)
        .then((res) => setL1Allowance(Number(res.toString())));
      l2Dai.balanceOf(account).then((res) =>
        setBalances((prevState) => ({
          ...prevState,
          l2Dai: Number(res.toString()),
        }))
      );
      l2Pool.balanceOf(account).then((res) =>
        setBalances((prevState) => ({
          ...prevState,
          l2PoolShare: Number(res.toString()),
        }))
      );
    }
  }, [account, l1Dai, l2Dai, l2Pool, wait]);

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
    setNetworkAlert("layer2");
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
        title="Token Bridge L1"
        infoText="ATTENTION! Always reset your account if you have send transactions on
        L1. Metamask gets irritated with the Nonces in local for some reason."
        balances={balances}
      >
        <>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <TokenInput
            label="L1 to L2"
            availableToken={balances?.l1Dai}
            handleClick={moveFundsFromL1ToL2}
            disabled={balances?.l1Dai === 0 || wait || !account}
            waiting={wait}
          />
        </>
      </BridgeInterface>
    </div>
  );
}
