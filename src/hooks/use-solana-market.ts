"use client";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useSolanaWallet } from "@/components/wallet/solana-provider";
import type { SolanaConfig } from "@/config/solana";
import type { SolanaAddress } from "@/lib/solana/address";
import { readMint } from "@/lib/solana/rpc";
import {
  loadSolanaCandles,
  loadSolanaMarket,
  loadSolanaTrades,
} from "@/lib/market/solana-market";
import type { CandleInterval, TokenRef } from "@/lib/market/types";
export const POOLS_REFRESH_MS = 60_000,
  TRADES_REFRESH_MS = 60_000;
export const CANDLE_REFRESH_MS: Record<CandleInterval, number> = {
  "5m": 60_000,
  "15m": 120_000,
  "1h": 300_000,
  "4h": 600_000,
  "1d": 600_000,
};
export function onchainTokenQuery(
  config: SolanaConfig | null,
  token: TokenRef,
) {
  return queryOptions({
    queryKey: [
      "solana-market",
      "mint",
      token.cluster,
      token.address,
      config?.rpcUrl,
    ],
    queryFn: ({ signal }) => {
      if (!config || config.cluster !== token.cluster)
        throw new Error("RPC cluster mismatch.");
      return readMint(config, token.address, signal);
    },
    enabled: Boolean(config && config.cluster === token.cluster),
    staleTime: 60_000,
    retry: false,
  });
}
export function useOnchainToken(token: TokenRef) {
  const { config } = useSolanaWallet();
  return useQuery(onchainTokenQuery(config, token));
}
export function tokenMarketQuery(
  token: TokenRef,
  pinnedPoolId?: SolanaAddress,
  enabled = true,
) {
  return queryOptions({
    queryKey: [
      "solana-market",
      "pools",
      token.cluster,
      token.address,
      pinnedPoolId,
    ],
    queryFn: ({ signal }) => loadSolanaMarket(token, { pinnedPoolId, signal }),
    enabled: enabled && token.cluster === "mainnet-beta",
    staleTime: 30_000,
    refetchInterval: POOLS_REFRESH_MS,
    retry: 1,
  });
}
export function useTokenMarket(
  token: TokenRef,
  pinned?: SolanaAddress,
  enabled = true,
) {
  return useQuery(tokenMarketQuery(token, pinned, enabled));
}
export function useCandles(
  token: TokenRef,
  pool: SolanaAddress | undefined,
  interval: CandleInterval,
) {
  return useQuery({
    queryKey: [
      "solana-market",
      "candles",
      token.cluster,
      token.address,
      pool,
      interval,
    ],
    queryFn: ({ signal }) =>
      loadSolanaCandles(token, pool!, interval, { signal }),
    enabled: Boolean(pool) && token.cluster === "mainnet-beta",
    staleTime: CANDLE_REFRESH_MS[interval] / 2,
    refetchInterval: CANDLE_REFRESH_MS[interval],
    retry: 1,
  });
}
export function useMarketTrades(
  token: TokenRef,
  pool: SolanaAddress | undefined,
) {
  return useQuery({
    queryKey: ["solana-market", "activity", token.cluster, token.address, pool],
    queryFn: ({ signal }) => loadSolanaTrades(token, pool!, { signal }),
    enabled: Boolean(pool) && token.cluster === "mainnet-beta",
    staleTime: 30_000,
    refetchInterval: TRADES_REFRESH_MS,
    retry: 1,
  });
}
