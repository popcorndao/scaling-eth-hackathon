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
      <div className="mx-auto p-8 py-10 flex flex-row justify-center mt-12">
        <h2>Mainnet</h2>
        <span className="flex flex-row justify-between">
          <p>{balances?.l1Dai ?? 0}</p>
          <p>Dai</p>
        </span>
        <div className="w-1/3">
        <div className="flex flex-col mx-auto space-y-4 mt-4">{children}</div>
          <img
            className="inline mr-2"
            src="/images/bridge.png"
            alt="logo"
          />
        </div>
        
        <div>
          <h2>Optimism</h2>
          <span className="flex flex-row justify-between">
            <p>{balances?.l2Dai ?? 0}</p>
            <p>oDai</p>
          </span>
        </div>
      </div>
    </div>
  );
}
