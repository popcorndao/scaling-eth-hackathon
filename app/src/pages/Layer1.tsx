import { Watcher } from "@eth-optimism/watcher";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";
import { useEthers } from "@usedapp/core";
import { useEffect, useState } from "react";
import Modal from "src/components/Modal";
import Navbar from "src/components/Navbar";
import mockERC20 from "../abi/ERC20.json";
import l1_ERC20Gateway from "../abi/iOVM_L1TokenGateway.json";
import mockL2ERC20 from "../abi/L2DepositedERC20.json";

// L1 messenger address depends on the deployment, this is default for our local deployment.
const l1MessengerAddress = "0x59b670e9fA9D0A427751Af201D676719a970857b";
// L2 messenger address is always the same.
const l2MessengerAddress = "0x4200000000000000000000000000000000000007";

export default function Layer1(): JSX.Element {
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
  const [l1TokenGateway, setL1TokenGateway] = useState<Contract>();
  const [l1EthBalance, setL1EthBalance] = useState<number>(0);
  const [l2EthBalance, setL2EthBalance] = useState<number>(0);
  const [l1Allowance, setL1Allowance] = useState<number>(0);
  const [wait, setWait] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<"layer1" | "layer2" | null>(null);
  const l2Provider = new JsonRpcProvider("http://localhost:8545");

  useEffect(() => {
    if (chainId === undefined) {
      return;
    }
    if (chainId !== 31337) {
      setShowModal("layer1");
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
    setL1Eth(
      new Contract(
        "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf",
        mockERC20.abi,
        library?.getSigner()
      )
    );
    setL2Eth(
      new Contract(
        "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        mockL2ERC20.abi,
        l2Provider?.getSigner()
      )
    );
    setL1TokenGateway(
      new Contract(
        "0x0E801D84Fa97b50751Dbf25036d067dCf18858bF",
        l1_ERC20Gateway.abi,
        library?.getSigner()
      )
    );
  }, [account]);

  useEffect(() => {
    if (account && l1Eth && l2Eth) {
      l1Eth
        .balanceOf(account)
        .then((res) => setL1EthBalance(Number(res.toString())));
      l1Eth
        .allowance(account, l1TokenGateway.address)
        .then((res) => setL1Allowance(Number(res.toString())));
      l2Eth
        .balanceOf(account)
        .then((res) => setL2EthBalance(Number(res.toString())));
    }
  }, [account, l1Eth, l2Eth]);

  function approveTokenGateway(): void {
    setWait(true);
    l1Eth
      .approve(l1TokenGateway.address, 999999)
      .then((res) => res.wait())
      .catch((res) => console.log("approved"));
    setWait(false);
  }

  async function moveFundsFromL1ToL2(): Promise<void> {
    setWait(true);
    const tx = await l1TokenGateway
      .deposit(500)
      .catch((err) => console.log(err));
    await tx.wait();
    const [msgHash1] = await watcher.getMessageHashesFromL1Tx(tx.hash);
    await watcher.getL2TransactionReceipt(msgHash1);
    l1Eth.balanceOf(account).then((res) => setL1EthBalance(res.toString()));
    l2Eth.balanceOf(account).then((res) => setL2EthBalance(res.toString()));
    setWait(false);
    setShowModal("layer2");
  }

  return (
    <div className="bg-gray-800 w-screen h-screen text-white flex flex-col">
      <Navbar />
      {showModal === "layer2" && (
        <Modal>
          <div className="flex flex-col">
            <p className="text-gray-800 text-center">
              Switch to L2 in Metamask to continue
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
        <h1 className="font-black text-6xl text-center mb-4">Token Bridge L1</h1>
        <p className="text-center max-w-2xl mx-auto">
          ATTENTION! Always reset your account if you have send transactions on
          L1. Metamask gets irritated with the Nonces in local for some reason.
        </p>
        <div className="mx-auto w-80 p-8 py-10 bg-gray-600 rounded-lg flex flex-col justify-center">
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
          {account && l1Allowance < 1234 && (
            <button
              className="bborder border-indigo-500 rounded-md p-2 mt-4 bg-indigo-600 disabled:opacity-50"
              onClick={approveTokenGateway}
            >
              Approve
            </button>
          )}
          {account && (
            <div className="flex flex-row mx-auto space-x-4 mt-4">
              <button
                className="border border-indigo-500 rounded-md p-2 bg-indigo-600 disabled:opacity-50"
                onClick={moveFundsFromL1ToL2}
                disabled={l1EthBalance < 1}
              >
                L1 to L2
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
