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
          process.env.REACT_APP_L1_DAI_ADDRESS,
          mockERC20.abi,
          l1Signer
        )
      );
      setL2Dai(
        new Contract(
          process.env.REACT_APP_L2_DAI_ADDRESS,
          mockL2ERC20.abi,
          l2Signer
        )
      );
      setL2Pool(
        new Contract(
          process.env.REACT_APP_L2_POOL_ADDRESS, 
          l2_Pool.abi,
          l2Signer
        )
      );
      setL1TokenGateway(
        new Contract(
          process.env.REACT_APP_L1_TOKEN_GATEWAY_ADDRESS,
          l1_ERC20Gateway.abi,
          l1Signer
        )
      );
    }
  }, [account, chainId]);
  return [l1Dai, l2Dai, l2Pool, l1TokenGateway];
}
