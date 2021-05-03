import type { Dispatch } from "react";
import Modal from "./Modal";

interface SwitchNetworkAlertProps {
  networkAlert: "layer1" | "layer2" | null;
  setNetworkAlert: Dispatch<"layer1" | "layer2" | null>;
}

export default function SwitchNetworkAlert({
  networkAlert,
  setNetworkAlert,
}: SwitchNetworkAlertProps): JSX.Element {
  return (
    <>
      {networkAlert === "layer2" && (
        <Modal>
          <div className="flex flex-col">
            <p className="text-gray-800 text-center">
              Switch to L2 in Metamask to continue
            </p>
            <button
              className="w-24 h-10 mt-4 bg-indigo-600 rounded-md mx-auto hover:bg-indigo-700"
              onClick={() => setNetworkAlert(null)}
            >
              Ok
            </button>
          </div>
        </Modal>
      )}
      {networkAlert === "layer1" && (
        <Modal>
          <div className="flex flex-col">
            <p className="text-gray-800 text-center">
              Switch to L1 in Metamask to continue
            </p>
            <button
              className="w-24 h-10 mt-4 bg-indigo-600 rounded-md mx-auto hover:bg-indigo-700"
              onClick={() => setNetworkAlert(null)}
            >
              Ok
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
