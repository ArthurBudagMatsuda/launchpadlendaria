import type { Address, Hex } from "viem";

/**
 * Normalized market-data models. Provider responses are validated and mapped
 * into these types in `providers/*`; nothing provider-specific reaches the UI.
 * A token is identified by chain ID plus checksummed address, never by symbol.
 */
export interface TokenRef {
  chainId: number;
  address: Address;
}

export type MarketSourceId = "geckoterminal" | "dexscreener";
export type DataSourceId = MarketSourceId | "base-rpc";

/** Where a value came from and when. Shown next to every market figure. */
export interface Provenance {
  source: DataSourceId;
  chainId: number;
  token: Address;
  /** Pool address (v2/v3) or 32-byte pool ID (v4), when the value is per pool. */
  poolId?: Hex;
  /** When RETRY received the response (ms since epoch). */
  retrievedAt: number;
  /** When the provider says the value was observed, if it says. */
  observedAt?: number;
}

export type QuoteKind = "native-eth" | "weth" | "usdc" | "other";
export type DexProtocol =
  "uniswap-v2" | "uniswap-v3" | "uniswap-v4" | "aerodrome" | "unknown";

export interface PoolToken {
  address: Address;
  symbol: string;
}

export interface PoolIdentity {
  chainId: number;
  id: Hex;
  /** Provider's DEX identifier, e.g. "uniswap-v4-base" or "uniswap". */
  dex: string;
  protocol: DexProtocol;
  /** Fee tier or pool label as reported, e.g. "5%". Informational. */
  label?: string;
  baseToken: PoolToken;
  quoteToken: PoolToken & { kind: QuoteKind };
  createdAt?: number;
}

/** A figure over the last 5 minutes, hour, 6 hours and 24 hours. */
export interface Windowed<T> {
  m5: T | null;
  h1: T | null;
  h6: T | null;
  h24: T | null;
}

export interface TxCounts {
  buys: number;
  sells: number;
}

/** One pool's market, as one provider reports it. Prices are decimal strings. */
export interface PoolMarket {
  pool: PoolIdentity;
  /** Base-token price in USD (exact decimal string). */
  priceUsd: string | null;
  /** Base-token price in the quote asset (exact decimal string). */
  priceQuote: string | null;
  /** Provider's USD valuation of the pool's reserves. */
  liquidityUsd: string | null;
  /** USD volume per window (exact decimal strings). */
  volumeUsd: Windowed<string>;
  /** Price change in percent per window (display only). */
  priceChangePct: Windowed<number>;
  txns: { h1: TxCounts | null; h24: TxCounts | null };
  provenance: Provenance;
}

export type CandleInterval = "5m" | "15m" | "1h" | "4h" | "1d";

/** One OHLCV candle; `time` is the bucket start in Unix seconds (UTC). */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Volume in USD for the bucket. */
  volumeUsd: number;
}

export interface CandleSeries {
  pool: Hex;
  interval: CandleInterval;
  candles: Candle[];
  /** Buckets missing between the first and last candle (no trades observed). */
  gaps: number;
  provenance: Provenance;
}

/** A swap in the pool, as indexed by the provider. Never a wallet's own history. */
export interface MarketTrade {
  id: string;
  txHash: Hex;
  blockNumber: number;
  time: number;
  side: "buy" | "sell";
  /** Amount of the tracked token, human units (decimal string). */
  tokenAmount: string;
  /** Tracked-token price in USD at the trade (decimal string). */
  priceUsd: string | null;
  volumeUsd: string | null;
  trader: Address | null;
}

export interface TradeList {
  pool: Hex;
  trades: MarketTrade[];
  provenance: Provenance;
}
