"use client";
import { useCallback, useMemo, useState } from "react";
import {
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { erc20Abi, type Address, type Hex } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import {
  countGaps,
  INTERVAL_SECONDS,
  mergeCandles,
} from "@/lib/market/chart-series";
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
import type { Candle, CandleInterval, TokenRef } from "@/lib/market/types";

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

/** A failed older page waits this long before the view asks again. */
const OLDER_RETRY_MS = 30_000;

/**
 * The chart's candles: the newest page, refreshed, plus older pages that
 * `loadOlder` fetches when the view reaches the oldest candle, as on
 * TradingView and GMGN. Older pages never refresh. They chain back from the
 * newest page as it was when older history was first asked for; that copy
 * stays in the series, so no candle goes missing when later refreshes slide
 * the newest page forward.
 */
export function useCandleHistory(
  token: TokenRef,
  pool: Hex | undefined,
  interval: CandleInterval,
) {
  const newest = useCandles(token, pool, interval);
  const [bases, setBases] = useState<Record<string, readonly Candle[]>>({});
  const key = `${pool}:${interval}`;
  const base = bases[key];
  const before = base?.[0]?.time ?? 0;
  const older = useInfiniteQuery({
    queryKey: [
      ...marketKeys.candles(token, pool ?? "0x", interval),
      "older",
      before,
    ],
    queryFn: ({ pageParam, signal }) =>
      loadCandles(token, pool!, interval, { signal }, pageParam),
    initialPageParam: before,
    // A page holding nothing older than its boundary is the pool's first.
    getNextPageParam: (last, _pages, param) => {
      const oldest = last.candles[0]?.time;
      return oldest !== undefined && oldest < param ? oldest : undefined;
    },
    enabled: Boolean(pool && before),
    staleTime: Infinity,
    retry: shouldRetryMarketQuery,
  });
  const newestCandles = newest.data?.candles;
  const loadOlder = useCallback(() => {
    if (!newestCandles?.length) return;
    if (!base) {
      setBases((all) => (all[key] ? all : { ...all, [key]: newestCandles }));
      return;
    }
    if (older.isFetching) return;
    if (older.isError && Date.now() - older.errorUpdatedAt < OLDER_RETRY_MS)
      return;
    if (!older.data) void older.refetch();
    else if (older.hasNextPage) void older.fetchNextPage();
  }, [newestCandles, base, key, older]);
  const data = useMemo(() => {
    if (!newest.data) return undefined;
    const pages = (older.data?.pages ?? []).map((page) => page.candles);
    const candles = mergeCandles(
      ...pages.reverse(),
      base ?? [],
      newest.data.candles,
    );
    return {
      ...newest.data,
      candles,
      gaps: countGaps(candles, INTERVAL_SECONDS[interval]),
    };
  }, [newest.data, older.data, base, interval]);
  return {
    newest,
    data,
    loadOlder,
    loadingOlder: older.isFetching,
    olderFailed: older.isError,
  };
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
