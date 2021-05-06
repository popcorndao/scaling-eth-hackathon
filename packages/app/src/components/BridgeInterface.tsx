import { useEthers } from "@usedapp/core";
import type { TokenBalances } from "src/interfaces/interfaces";

interface BridgeInterfaceProps {
  chain: "L1" | "L2";
  children: JSX.Element;
  balances: TokenBalances;
}

export default function BridgeInterface({
  chain,
  children,
  balances,
}: BridgeInterfaceProps): JSX.Element {
  const { account, activateBrowserWallet } = useEthers();
  return (
    <div className="mt-48">
      <h1 className="font-black text-6xl text-center mb-4">
        Token Bridge {chain}
      </h1>
      <p className="text-center max-w-2xl mx-auto">
        ATTENTION! Always reset your account if you have send transactions on
        {chain} Metamask gets irritated with the Nonces in local for some
        reason.
      </p>
      <div className="mx-auto w-80 p-8 py-10 bg-gray-600 rounded-lg flex flex-col justify-center mt-12">
        <span className="flex flex-row justify-between">
          <p>L1 Dai</p>
          <p>{balances?.l1Dai ?? 0}</p>
        </span>
        <span className="flex flex-row justify-between">
          <p>L2 Dai</p>
          <p>{balances?.l2Dai ?? 0}</p>
        </span>
        <span className="flex flex-row justify-between">
          <p>L2 Pool Share</p>
          <p>{balances?.l2PoolShare ?? 0}</p>
        </span>
        {!account && (
          <button
            className="border border-indigo-500 rounded-md p-2 mt-4 bg-indigo-600 disabled:opacity-50"
            onClick={() => activateBrowserWallet()}
          >
            Activate
          </button>
        )}
        <div className="flex flex-col mx-auto space-y-4 mt-4">{children}</div>
      </div>
    </div>
  );
}
