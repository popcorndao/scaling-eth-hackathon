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
            className="button button-primary mt-4"
            onClick={() => setNetworkAlert(false)}
          >
            Ok
          </button>
        </div>
      </Modal>
    )
  );
}
