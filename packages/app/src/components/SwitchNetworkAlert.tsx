import type { Dispatch } from "react";
import Modal from "./Modal";

interface SwitchNetworkAlertProps {
  networkAlert: boolean;
  setNetworkAlert: Dispatch<boolean>;
}

export default function SwitchNetworkAlert({
  networkAlert,
  setNetworkAlert,
}: SwitchNetworkAlertProps): JSX.Element {
  return (
    networkAlert && (
      <Modal>
        <div className="flex flex-col">
          <p className="text-gray-800 text-center">
            Set your network to localhost:8545 or localhost:9545 in Metamask to continue
          </p>
          <button
            className="w-24 h-10 mt-4 bg-indigo-600 rounded-md mx-auto hover:bg-indigo-700"
            onClick={() => setNetworkAlert(false)}
          >
            Ok
          </button>
        </div>
      </Modal>
    )
  );
}
