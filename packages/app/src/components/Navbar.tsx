import { useEthers } from "@usedapp/core";
import { NavLink } from "react-router-dom";

export default function Navbar(): JSX.Element {
  const { account, activateBrowserWallet } = useEthers();
  return (
    <nav className="flex flex-row items-center justify-between px-8 py-2">
      <span className="flex flex-row items-center justify-start w-56">
        <img
          className="inline w-10 h-10 mr-2"
          src="/images/popcorn_v1_rainbow_bg.png"
          alt="logo"
        />
      </span>
      <div className="w-56 flex justify-center">
      <span className="space-x-4">
        <NavLink activeClassName="font-bold" to="/bridge">
          Bridge
        </NavLink>
        <NavLink activeClassName="font-bold" to="/pool">
          Yield Optimizer
        </NavLink>
      </span>
      </div>
      <div className="w-56 flex justify-end">
        <button
          className={`button button-secondary  flex flex-row items-center`}
          onClick={activateBrowserWallet}
        >
          {!account && "Connect"}
          {account && (
            <span>Connected<div className="w-4 h-4 ml-2 inline-block bg-green-500 rounded-full flex-shrink-0" /></span>
          )}
        </button>
      </div>
    </nav>
  );
}
