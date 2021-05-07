import { useEthers } from "@usedapp/core";
import { useEffect, useState } from "react";
import type { TokenBalances } from "src/interfaces/interfaces";
import useContracts from "./useContracts";

export default function useDaiBalances(refresh:boolean):TokenBalances{
  const { account } = useEthers();
  const [l1Dai, l2Dai, l2Pool] = useContracts();
  const [balances, setBalances] = useState<TokenBalances>();

  useEffect(() => {
    if (account && l1Dai && l2Dai && l2Pool) {
      l1Dai.balanceOf(account).then((res) =>
        setBalances((prevState) => ({
          ...prevState,
          l1Dai: Number(res.toString()),
        }))
      );
      l2Dai.balanceOf(account).then((res) =>
        setBalances((prevState) => ({
          ...prevState,
          l2Dai: Number(res.toString()),
        }))
      );
      l2Pool.balanceOf(account).then((res) =>
        setBalances((prevState) => ({
          ...prevState,
          l2PoolShare: Number(res.toString()),
        }))
      );
    }
  }, [account, l1Dai, l2Dai, l2Pool,refresh]);
  return balances;
}