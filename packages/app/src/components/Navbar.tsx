import { useEthers } from "@usedapp/core";
import { NavLink } from "react-router-dom";

export default function Navbar(): JSX.Element {
  const { account,activateBrowserWallet } = useEthers();
  return (
    <nav className="flex flex-row justify-between items-center px-8 py-2">
      <h1 className="">Token Bridge</h1>
      <span className="space-x-4">
        <NavLink activeClassName="font-bold" to="/bridge">
          Bridge
        </NavLink>
        <NavLink activeClassName="font-bold" to="/pool">
          Pool
        </NavLink>
      </span>
      <button
        className={`rounded-md border border-white p-2 w-28 flex flex-row items-center hover:bg-gray-500`}
        onClick={activateBrowserWallet}
      >
        Connect
        {account && <div className="w-4 h-4 ml-2 bg-green-500 rounded-full" />}
      </button>
    </nav>
  );
}
