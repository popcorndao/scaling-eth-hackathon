import { Contract } from "@ethersproject/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";
import { useEthers } from "@usedapp/core";
import { useEffect, useState } from "react";
import mockERC20 from "../abi/ERC20.json";
import l1_ERC20Gateway from "../abi/iOVM_L1TokenGateway.json";
import mockL2ERC20 from "../abi/L2DepositedERC20.json";
import l2_Pool from "../abi/L2_Pool.json";

export default function useContracts(): Contract[] {
  const { account, chainId, library } = useEthers();
  const [l1Dai, setL1Dai] = useState<Contract>();
  const [l2Dai, setL2Dai] = useState<Contract>();
  const [l2Pool, setL2Pool] = useState<Contract>();
  const [l1TokenGateway, setL1TokenGateway] = useState<Contract>();
  const l1Provider = new JsonRpcProvider("http://localhost:9545");
  const l2Provider = new JsonRpcProvider("http://localhost:8545");

  useEffect(() => {
    if (chainId === 420 || chainId === 31337) {
      const l1Signer =
        chainId === 31337 ? library?.getSigner() : l1Provider?.getSigner();
      const l2Signer =
        chainId === 31337 ? l2Provider?.getSigner() : library?.getSigner();
      setL1Dai(
        new Contract(
          "0x809d550fca64d94Bd9F66E60752A544199cfAC3D",
          mockERC20.abi,
          l1Signer
        )
      );
      setL2Dai(
        new Contract(
          "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
          mockL2ERC20.abi,
          l2Signer
        )
      );
      setL2Pool(
        new Contract(
          "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
          l2_Pool.abi,
          l2Signer
        )
      );
      setL1TokenGateway(
        new Contract(
          "0x5f3f1dBD7B74C6B46e8c44f98792A1dAf8d69154",
          l1_ERC20Gateway.abi,
          l1Signer
        )
      );
    }
  }, [account, chainId]);
  return [l1Dai, l2Dai, l2Pool, l1TokenGateway];
}
