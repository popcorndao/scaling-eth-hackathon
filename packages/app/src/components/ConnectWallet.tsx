import { useEthers } from "@usedapp/core";
import { ReactComponent as WalletIcon } from "src/images/wallet-icon.svg";

export default function ConnectWallet(): JSX.Element {
  const { activateBrowserWallet } = useEthers();
  return (
    <div className="mx-auto mt-64 w-80 p-8 py-10 bg-white rounded-lg flex flex-col justify-center shadow-lg
     mt-12">
      <div className="mx-auto w-14 h-14 rounded-full bg-indigo-600 flex flex-col items-center justify-center mb-4">
        <div className="w-10 h-10 flex flex-col items-center justify-center">
          <WalletIcon />
        </div>
      </div>
      <h2 className="font-black text-xl text-center mb-1">Connect Wallet</h2>
      <p className="text-sm text-center ">You need to connect your wallet first to get started.</p>
      <button
        className="button button-primary mt-6"
        onClick={() => activateBrowserWallet()}
      >
        Activate
      </button>
    </div>
  );
}
