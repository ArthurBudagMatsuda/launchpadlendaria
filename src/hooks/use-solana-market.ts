"use client";
import { useCallback, useMemo, useState } from "react";
import {
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import {
  countGaps,
  INTERVAL_SECONDS,
  mergeCandles,
} from "@/lib/market/chart-series";
import { shouldRetryMarketQuery } from "@/lib/market/errors";
import { useSolanaWallet } from "@/components/wallet/solana-provider";
import type { SolanaConfig } from "@/config/solana";
import type { SolanaAddress } from "@/lib/solana/address";
import { readMint } from "@/lib/solana/rpc";
import {
  loadSolanaCandles,
  loadSolanaMarket,
  loadSolanaTrades,
} from "@/lib/market/solana-market";
import type { Candle, CandleInterval, TokenRef } from "@/lib/market/types";
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
/** Port of main's paged chart: preserve the initial page across live refreshes. */
export function useCandleHistory(
  token: TokenRef,
  pool: SolanaAddress | undefined,
  interval: CandleInterval,
) {
  const newest = useCandles(token, pool, interval);
  const [bases, setBases] = useState<Record<string, readonly Candle[]>>({});
  const key = `${token.cluster}:${token.address}:${pool}:${interval}`;
  const base = bases[key];
  const before = base?.[0]?.time ?? 0;
  const older = useInfiniteQuery({
    queryKey: [
      "solana-market",
      "candles",
      token.cluster,
      token.address,
      pool,
      interval,
      "older",
      before,
    ],
    queryFn: ({ pageParam, signal }) =>
      loadSolanaCandles(token, pool!, interval, { signal }, pageParam),
    initialPageParam: before,
    getNextPageParam: (last, _pages, boundary) => {
      const oldest = last.candles[0]?.time;
      return oldest !== undefined && oldest < boundary ? oldest : undefined;
    },
    enabled: Boolean(pool && before) && token.cluster === "mainnet-beta",
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
    if (
      older.isFetching ||
      (older.isError && Date.now() - older.errorUpdatedAt < 30_000)
    )
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
