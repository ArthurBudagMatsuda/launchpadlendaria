"use client";
import { useBalance, useConnection } from "wagmi";
import { isSupportedChain } from "@/config/networks";
export function useWalletBalance() {
  const connection = useConnection();
  return useBalance({
    address: connection.address,
    chainId: connection.chainId,
    query: {
      enabled: connection.isConnected && isSupportedChain(connection.chainId),
      retry: 1,
      staleTime: 30_000,
    },
  });
}
