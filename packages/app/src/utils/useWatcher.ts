import { Watcher } from "@eth-optimism/watcher";
import { JsonRpcProvider } from "@ethersproject/providers";
import { useEffect, useState } from "react";

// L1 messenger address depends on the deployment, this is default for our local deployment.
const l1MessengerAddress = "0x59b670e9fA9D0A427751Af201D676719a970857b";
// L2 messenger address is always the same.
const l2MessengerAddress = "0x4200000000000000000000000000000000000007";

export default function useWatcher(): any {
  const [watcher, setWatcher] = useState<any>();
  const l1Provider = new JsonRpcProvider("http://localhost:9545");
  const l2Provider = new JsonRpcProvider("http://localhost:8545");

  useEffect(() => {
    setWatcher(
      new Watcher({
        l1: {
          provider: l1Provider,
          messengerAddress: l1MessengerAddress,
        },
        l2: {
          provider: l2Provider,
          messengerAddress: l2MessengerAddress,
        },
      })
    );
  }, []);

  return [watcher];
}
