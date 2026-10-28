"use client";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { erc20Abi, type Address, type Hex } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { shouldRetryMarketQuery } from "@/lib/market/errors";
import {
  loadCandles,
  loadTokenMarket,
  loadTrades,
} from "@/lib/market/market-service";
import {
  readOnchainTokenFacts,
  type OnchainReader,
} from "@/lib/market/onchain";
import type { CandleInterval, TokenRef } from "@/lib/market/types";

/**
 * TanStack Query hooks for market data. They share the app's single
 * QueryClient (from RetryWeb3Provider), so every component asking for the
 * same token, pool or interval shares one cached request and one poll.
 * Polling pauses in background tabs (TanStack default) and providers' own
 * caches are 30–60 s, so nothing polls faster than once a minute.
 */
export const POOLS_REFRESH_MS = 60_000;
export const TRADES_REFRESH_MS = 60_000;
export const CANDLE_REFRESH_MS: Record<CandleInterval, number> = {
  "5m": 60_000,
  "15m": 120_000,
  "1h": 300_000,
  "4h": 600_000,
  "1d": 600_000,
};
const ONCHAIN_STALE_MS = 5 * 60_000;

export const marketKeys = {
  onchain: (t: TokenRef) =>
    ["market", "onchain", t.chainId, t.address] as const,
  pools: (t: TokenRef, pinned?: Hex) =>
    ["market", "pools", t.chainId, t.address, pinned ?? null] as const,
  candles: (t: TokenRef, pool: Hex, interval: CandleInterval) =>
    ["market", "ohlcv", t.chainId, t.address, pool, interval] as const,
  trades: (t: TokenRef, pool: Hex) =>
    ["market", "trades", t.chainId, t.address, pool] as const,
};

export function onchainTokenQuery(
  client: OnchainReader | undefined,
  token: TokenRef,
) {
  return queryOptions({
    queryKey: marketKeys.onchain(token),
    queryFn: () => {
      if (!client) throw new Error("No RPC client for this chain.");
      return readOnchainTokenFacts(client, token);
    },
    enabled: Boolean(client),
    staleTime: ONCHAIN_STALE_MS,
    retry: 1,
  });
}

/** ERC-20/B20 identity read from Base RPC (not from any market provider). */
export function useOnchainToken(token: TokenRef) {
  const client = usePublicClient({ chainId: token.chainId });
  return useQuery(onchainTokenQuery(client, token));
}

export function tokenMarketQuery(token: TokenRef, pinnedPoolId?: Hex) {
  return queryOptions({
    queryKey: marketKeys.pools(token, pinnedPoolId),
    queryFn: ({ signal }) => loadTokenMarket(token, { pinnedPoolId, signal }),
    staleTime: POOLS_REFRESH_MS / 2,
    refetchInterval: POOLS_REFRESH_MS,
    retry: shouldRetryMarketQuery,
  });
}

export function useTokenMarket(token: TokenRef, pinnedPoolId?: Hex) {
  return useQuery(tokenMarketQuery(token, pinnedPoolId));
}

export function useCandles(
  token: TokenRef,
  pool: Hex | undefined,
  interval: CandleInterval,
) {
  return useQuery({
    queryKey: marketKeys.candles(token, pool ?? "0x", interval),
    queryFn: ({ signal }) => loadCandles(token, pool!, interval, { signal }),
    enabled: Boolean(pool),
    staleTime: CANDLE_REFRESH_MS[interval] / 2,
    refetchInterval: CANDLE_REFRESH_MS[interval],
    retry: shouldRetryMarketQuery,
  });
}

export function useMarketTrades(token: TokenRef, pool: Hex | undefined) {
  return useQuery({
    queryKey: marketKeys.trades(token, pool ?? "0x"),
    queryFn: ({ signal }) => loadTrades(token, pool!, { signal }),
    enabled: Boolean(pool),
    staleTime: TRADES_REFRESH_MS / 2,
    refetchInterval: TRADES_REFRESH_MS,
    retry: shouldRetryMarketQuery,
  });
}

/** The connected wallet's balance of a tracked token, from Base RPC. */
export function useTokenBalance(
  token: TokenRef | undefined,
  owner: Address | undefined,
) {
  return useReadContract({
    chainId: token?.chainId,
    address: token?.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled: Boolean(token && owner), staleTime: 30_000 },
  });
}
