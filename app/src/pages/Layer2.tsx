import { Watcher } from "@eth-optimism/watcher";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";
import { useEthers } from "@usedapp/core";
import { useEffect, useState } from "react";
import Modal from "src/components/Modal";
import Navbar from "src/components/Navbar";
import { getOptimismRevertReason } from "src/utils/optimismHelper";
import mockERC20 from "../abi/ERC20.json";
import mockL2ERC20 from "../abi/L2DepositedERC20.json";

// L1 messenger address depends on the deployment, this is default for our local deployment.
const l1MessengerAddress = "0x59b670e9fA9D0A427751Af201D676719a970857b";
// L2 messenger address is always the same.
const l2MessengerAddress = "0x4200000000000000000000000000000000000007";

export default function Layer2(): JSX.Element {
  const {
    activateBrowserWallet,
    account,
    chainId,
    library,
    active,
    error,
  } = useEthers();
  const [l1Eth, setL1Eth] = useState<Contract>();
  const [l2Eth, setL2Eth] = useState<Contract>();
  const [watcher, setWatcher] = useState<any>();
  const [l1EthBalance, setL1EthBalance] = useState<number>(0);
  const [l2EthBalance, setL2EthBalance] = useState<number>(0);
  const [wait, setWait] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<"layer1" | "layer2" | null>(null);
  const l1Provider = new JsonRpcProvider("http://localhost:9545");

  useEffect(() => {
    if (chainId === undefined) {
      return;
    }
    if (chainId !== 420) {
      setShowModal("layer2");
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
    setL1Eth(
      new Contract(
        "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf",
        mockERC20.abi,
        l1Provider?.getSigner()
      )
    );
    console.log("check", account);
    setL2Eth(
      new Contract(
        "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        mockL2ERC20.abi,
        library?.getSigner()
      )
    );
  }, [account, chainId]);

  useEffect(() => {
    if (account && l2Eth && chainId === 420) {
      l1Eth
        .balanceOf(account)
        .then((res) => setL1EthBalance(Number(res.toString())));
      l2Eth
        .balanceOf(account)
        .then((res) => setL2EthBalance(Number(res.toString())));
    }
  }, [account, l1Eth, l2Eth, chainId]);

  async function moveFundsFromL2ToL1() {
    setWait(true);
    const tx = await l2Eth.withdraw(10, { gasLimit: 800000, gasPrice: 0 });
    getOptimismRevertReason(tx, library).then((err) =>
      console.log("optimism error", err)
    );
    await tx.wait();
    const [msgHash2] = await watcher.getMessageHashesFromL2Tx(tx.hash);
    await watcher.getL1TransactionReceipt(msgHash2);
    l1Eth.balanceOf(account).then((res) => setL1EthBalance(res.toString()));
    l2Eth.balanceOf(account).then((res) => setL2EthBalance(res.toString()));
    setWait(false);
    setShowModal("layer1");
  }

  return (
    <div className="bg-gray-800 w-screen h-screen text-white flex flex-col">
      <Navbar />
      {showModal === "layer2" && (
        <Modal>
          <div className="flex flex-col">
            <p className="text-gray-800 text-center">
              Switch to L2 in Metamask to continue.
            </p>
            <button
              className="w-24 h-10 mt-4 bg-indigo-600 rounded-md mx-auto hover:bg-indigo-700"
              onClick={() => setShowModal(null)}
            >
              Ok
            </button>
          </div>
        </Modal>
      )}
      {showModal === "layer1" && (
        <Modal>
          <div className="flex flex-col">
            <p className="text-gray-800 text-center">
              Switch to L1 in Metamask to continue
            </p>
            <button
              className="w-24 h-10 mt-4 bg-indigo-600 rounded-md mx-auto hover:bg-indigo-700"
              onClick={() => setShowModal(null)}
            >
              Ok
            </button>
          </div>
        </Modal>
      )}
      <div className="mt-48">
        <h1 className="font-black text-6xl text-center mb-4">Token Bridge L2</h1>
        <p className="text-center max-w-2xl mx-auto">
          ATTENTION! Always reset your account if you have send transactions on
          L1. Metamask gets irritated with the Nonces in local for some reason.
        </p>
        <div className="mx-auto w-80 p-8 py-10 bg-gray-600 rounded-lg flex flex-col justify-center mt-12">
          <span className="flex flex-row justify-between">
            <p>L1 Eth</p>
            <p>{l1EthBalance}</p>
          </span>
          <span className="flex flex-row justify-between">
            <p>L2 Eth</p>
            <p>{l2EthBalance}</p>
          </span>
          {!account && (
            <button
              className="border border-indigo-500 rounded-md p-2 mt-4 bg-indigo-600 disabled:opacity-50"
              onClick={() => activateBrowserWallet()}
            >
              Activate
            </button>
          )}
          {account && (
            <div className="flex flex-row mx-auto space-x-4 mt-4">
              <button
                className="border border-indigo-500 rounded-md p-2 bg-indigo-600 disabled:opacity-50"
                onClick={moveFundsFromL2ToL1}
                disabled={l2EthBalance < 1 || wait}
              >
                L2 to L1
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
