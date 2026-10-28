import type { Hex } from "viem";
import {
  isMarketDataError,
  MarketDataError,
  type MarketDataErrorCode,
} from "./errors";
import type { MarketFetchOptions } from "./http";
import { selectPrimaryPool, type PoolSelection } from "./pool-selection";
import { fetchDexscreenerPools } from "./providers/dexscreener";
import {
  fetchGeckoCandles,
  fetchGeckoPools,
  fetchGeckoTrades,
} from "./providers/geckoterminal";
import type {
  CandleInterval,
  CandleSeries,
  MarketSourceId,
  PoolMarket,
  TokenRef,
  TradeList,
} from "./types";

/**
 * Orchestrates providers: GeckoTerminal first, DEX Screener when GeckoTerminal
 * fails or lists no eligible pool. Results are never merged across providers;
 * the snapshot says which one answered. There is no fixture or synthetic
 * fallback: when both fail, the error reaches the UI.
 */
export interface ProviderFailure {
  source: MarketSourceId;
  code: MarketDataErrorCode | "UNKNOWN";
  message: string;
}

export interface TokenMarket {
  token: TokenRef;
  source: MarketSourceId;
  fallbackUsed: boolean;
  failures: ProviderFailure[];
  /** Every pool the answering provider lists for the token. */
  pools: PoolMarket[];
  selection: PoolSelection;
  retrievedAt: number;
}

type PoolFetcher = (
  token: TokenRef,
  options?: MarketFetchOptions,
) => Promise<PoolMarket[]>;

export const POOL_PROVIDERS: { source: MarketSourceId; fetch: PoolFetcher }[] =
  [
    { source: "geckoterminal", fetch: fetchGeckoPools },
    { source: "dexscreener", fetch: fetchDexscreenerPools },
  ];

function failure(source: MarketSourceId, error: unknown): ProviderFailure {
  return isMarketDataError(error)
    ? { source, code: error.code, message: error.message }
    : {
        source,
        code: "UNKNOWN",
        message: error instanceof Error ? error.message : String(error),
      };
}

export async function loadTokenMarket(
  token: TokenRef,
  options: MarketFetchOptions & {
    pinnedPoolId?: Hex;
    providers?: typeof POOL_PROVIDERS;
  } = {},
): Promise<TokenMarket> {
  const providers = options.providers ?? POOL_PROVIDERS;
  const failures: ProviderFailure[] = [];
  let empty: TokenMarket | undefined;
  for (const [index, provider] of providers.entries()) {
    try {
      const pools = await provider.fetch(token, options);
      const selection = selectPrimaryPool(token, pools, options.pinnedPoolId);
      const market: TokenMarket = {
        token,
        source: provider.source,
        fallbackUsed: index > 0,
        failures: [...failures],
        pools,
        selection,
        retrievedAt: Date.now(),
      };
      if (selection.primary) return market;
      empty ??= market;
      failures.push({
        source: provider.source,
        code: "NO_ELIGIBLE_POOL",
        message: new MarketDataError("NO_ELIGIBLE_POOL").message,
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      failures.push(failure(provider.source, error));
    }
  }
  // A provider answered but no pool qualifies: a real "no market" state.
  if (empty) return { ...empty, failures };
  const first = failures[0];
  throw new MarketDataError(
    first && first.code !== "UNKNOWN" && first.code !== "NO_ELIGIBLE_POOL"
      ? first.code
      : "NETWORK",
    {
      source: first?.source,
      message: failures.map((f) => `${f.source}: ${f.message}`).join(" · "),
    },
  );
}

/**
 * OHLCV comes from GeckoTerminal only; DEX Screener has no candle API. With
 * `before`, the older page that ends at that candle.
 */
export function loadCandles(
  token: TokenRef,
  poolId: Hex,
  interval: CandleInterval,
  options?: MarketFetchOptions,
  before?: number,
): Promise<CandleSeries> {
  return fetchGeckoCandles(token, poolId, interval, options, before);
}

export function loadTrades(
  token: TokenRef,
  poolId: Hex,
  options?: MarketFetchOptions,
): Promise<TradeList & { hiddenAnomalous: number }> {
  return fetchGeckoTrades(token, poolId, options);
}
