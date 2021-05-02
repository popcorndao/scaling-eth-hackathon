import { ChainId, Config, DAppProvider } from "@usedapp/core";
import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./index.css";

const config: Config = {
  readOnlyChainId: ChainId.Hardhat,
  readOnlyUrls: {
    [ChainId.Hardhat]: "http://localhost:9545",
    [420]: "http://localhost:8545",
  },
  multicallAddresses: {
    [ChainId.Hardhat]: "http://localhost:9545",
    [420]: "http://localhost:8545",
  },
  supportedChains: [ChainId.Hardhat, 420],
};

ReactDOM.render(
  <React.StrictMode>
    <DAppProvider config={config}>
      <App />
    </DAppProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
