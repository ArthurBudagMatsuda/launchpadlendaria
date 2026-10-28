import type { Hex } from "viem";
import { MarketDataError } from "../errors";
import { getProviderJson, type MarketFetchOptions } from "../http";
import { marketNetwork, quoteKind } from "../networks";
import type {
  Candle,
  CandleInterval,
  CandleSeries,
  DexProtocol,
  MarketTrade,
  PoolMarket,
  TokenRef,
  TradeList,
} from "../types";
import {
  asAddress,
  asAmount,
  asArray,
  asCount,
  asFiniteNumber,
  asLabel,
  asObject,
  asPoolId,
  asString,
  asTimestampMs,
  asTxHash,
  txCounts,
  windowed,
  type Json,
} from "../validate";

/**
 * GeckoTerminal public API v2 (https://www.geckoterminal.com/dex-api).
 * No key, CORS enabled, about 30 requests a minute per client. Primary source
 * for pools, per-pool statistics, OHLCV candles and recent trades.
 */
const SOURCE = "geckoterminal" as const;
const HEADERS = { Accept: "application/json;version=20230203" };

export const GECKOTERMINAL_INTERVALS: Record<
  CandleInterval,
  {
    timeframe: "minute" | "hour" | "day";
    aggregate: number;
    seconds: number;
  }
> = {
  "5m": { timeframe: "minute", aggregate: 5, seconds: 300 },
  "15m": { timeframe: "minute", aggregate: 15, seconds: 900 },
  "1h": { timeframe: "hour", aggregate: 1, seconds: 3600 },
  "4h": { timeframe: "hour", aggregate: 4, seconds: 14_400 },
  "1d": { timeframe: "day", aggregate: 1, seconds: 86_400 },
};
/**
 * GeckoTerminal's largest OHLCV page, so the chart zooms out over as much
 * history as one request returns. Intervals without trades are not counted:
 * a busy pool gets about 3.5 days of 5m candles, a young or quiet one its
 * whole history at 1h and above.
 */
const CANDLE_LIMIT = 1000;

function networkPath(token: TokenRef) {
  return `/api/v2/networks/${marketNetwork(token.chainId).geckoterminal}`;
}

function invalid(message: string): never {
  throw new MarketDataError("INVALID_RESPONSE", { source: SOURCE, message });
}

/** "base_0xabc…" → checksummed address on the expected network. */
function relationshipAddress(value: unknown, network: string) {
  const id = asString(asObject(asObject(value)?.data)?.id);
  if (!id?.startsWith(`${network}_`)) return null;
  return asAddress(id.slice(network.length + 1));
}

export function geckoProtocol(dex: string): DexProtocol {
  const id = dex.toLowerCase();
  if (id.includes("uniswap")) {
    if (id.includes("v4")) return "uniswap-v4";
    if (id.includes("v3")) return "uniswap-v3";
    if (id.includes("v2")) return "uniswap-v2";
  }
  if (id.includes("aerodrome") || id.startsWith("aero")) return "aerodrome";
  // e.g. GeckoTerminal lists the main worth/ETH v4 pool as "o1-launchpad".
  return "unknown";
}

export function normalizeGeckoPool(
  token: TokenRef,
  record: unknown,
  symbols: Map<string, string>,
  retrievedAt: number,
): PoolMarket | null {
  const network = marketNetwork(token.chainId).geckoterminal;
  const item = asObject(record);
  const attributes = asObject(item?.attributes);
  const relationships = asObject(item?.relationships);
  if (!attributes || !relationships) return null;
  const id = asPoolId(attributes.address);
  const base = relationshipAddress(relationships.base_token, network);
  const quote = relationshipAddress(relationships.quote_token, network);
  const dex =
    asLabel(asObject(asObject(relationships.dex)?.data)?.id, 60) ?? "unknown";
  if (!id || !base || !quote) return null;
  const name = asLabel(attributes.name, 120) ?? "";
  const label = /(\d+(?:\.\d+)?%)$/.exec(name)?.[1];
  const volume = windowed(
    attributes.volume_usd,
    { m5: "m5", h1: "h1", h6: "h6", h24: "h24" },
    asAmount,
  );
  const transactions = asObject(attributes.transactions);
  return {
    pool: {
      chainId: token.chainId,
      id,
      dex,
      protocol: geckoProtocol(dex),
      label,
      baseToken: {
        address: base,
        symbol: symbols.get(base.toLowerCase()) ?? "?",
      },
      quoteToken: {
        address: quote,
        symbol: symbols.get(quote.toLowerCase()) ?? "?",
        kind: quoteKind(token.chainId, quote),
      },
      createdAt: asTimestampMs(attributes.pool_created_at) ?? undefined,
    },
    priceUsd: asAmount(attributes.base_token_price_usd),
    priceQuote: asAmount(attributes.base_token_price_quote_token),
    liquidityUsd: asAmount(attributes.reserve_in_usd),
    volumeUsd: volume,
    priceChangePct: windowed(
      attributes.price_change_percentage,
      { m5: "m5", h1: "h1", h6: "h6", h24: "h24" },
      asFiniteNumber,
    ),
    txns: {
      h1: txCounts(transactions?.h1),
      h24: txCounts(transactions?.h24),
    },
    provenance: {
      source: SOURCE,
      chainId: token.chainId,
      token: token.address,
      poolId: id,
      retrievedAt,
    },
  };
}

/** Every pool GeckoTerminal lists for the token (first page, up to 20). */
export async function fetchGeckoPools(
  token: TokenRef,
  options?: MarketFetchOptions,
): Promise<PoolMarket[]> {
  const network = marketNetwork(token.chainId).geckoterminal;
  const body = asObject(
    await getProviderJson(
      SOURCE,
      `${networkPath(token)}/tokens/${token.address.toLowerCase()}/pools?page=1&include=base_token,quote_token`,
      HEADERS,
      options,
    ),
  );
  const data = asArray(body?.data);
  if (!data) invalid("The pools response has no data array.");
  const retrievedAt = Date.now();
  const symbols = new Map<string, string>();
  for (const entry of asArray(body?.included) ?? []) {
    const attributes = asObject(asObject(entry)?.attributes);
    const address = asAddress(attributes?.address);
    const symbol = asLabel(attributes?.symbol, 32);
    const id = asString(asObject(entry)?.id);
    if (address && symbol && id === `${network}_${address.toLowerCase()}`)
      symbols.set(address.toLowerCase(), symbol);
  }
  return data
    .map((record) => normalizeGeckoPool(token, record, symbols, retrievedAt))
    .filter((pool): pool is PoolMarket => pool !== null);
}

function validCandle(row: unknown): Candle | null {
  const values = asArray(row);
  if (!values || values.length < 6) return null;
  const [time, open, high, low, close, volume] = values.map(asFiniteNumber);
  if (
    time === null ||
    !Number.isSafeInteger(time) ||
    asTimestampMs(time * 1000) === null ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    volume === null
  )
    return null;
  if (
    open <= 0 ||
    low <= 0 ||
    volume < 0 ||
    high < Math.max(open, close, low) ||
    low > Math.min(open, close)
  )
    return null;
  return { time, open, high, low, close, volumeUsd: volume };
}

/**
 * Validates, orders and de-duplicates OHLCV rows. Invalid rows are dropped and
 * counted; missing buckets stay missing (no interpolation).
 */
export function normalizeCandles(rows: unknown[], intervalSeconds: number) {
  const byTime = new Map<number, Candle>();
  let dropped = 0;
  for (const row of rows) {
    const candle = validCandle(row);
    if (!candle || candle.time % intervalSeconds !== 0) {
      dropped += 1;
      continue;
    }
    // Rows arrive newest first; keep the first (latest) version of a bucket.
    if (!byTime.has(candle.time)) byTime.set(candle.time, candle);
    else dropped += 1;
  }
  const candles = [...byTime.values()].sort((a, b) => a.time - b.time);
  let gaps = 0;
  for (let i = 1; i < candles.length; i += 1)
    gaps += (candles[i].time - candles[i - 1].time) / intervalSeconds - 1;
  return { candles, gaps, dropped };
}

export async function fetchGeckoCandles(
  token: TokenRef,
  poolId: Hex,
  interval: CandleInterval,
  options?: MarketFetchOptions,
): Promise<CandleSeries> {
  const pool = asPoolId(poolId);
  if (!pool) throw new MarketDataError("INVALID_INPUT", { source: SOURCE });
  const spec = GECKOTERMINAL_INTERVALS[interval];
  const address = token.address.toLowerCase();
  const body = asObject(
    await getProviderJson(
      SOURCE,
      `${networkPath(token)}/pools/${pool}/ohlcv/${spec.timeframe}?aggregate=${spec.aggregate}&limit=${CANDLE_LIMIT}&currency=usd&token=${address}`,
      HEADERS,
      options,
    ),
  );
  const rows = asArray(asObject(asObject(body?.data)?.attributes)?.ohlcv_list);
  if (!rows) invalid("The OHLCV response has no ohlcv_list.");
  // The series must describe the tracked token, not the other side of the pair.
  const metaBase = asAddress(asObject(asObject(body?.meta)?.base)?.address);
  if (metaBase && metaBase.toLowerCase() !== address)
    invalid("The OHLCV series is priced for a different token.");
  const { candles, gaps, dropped } = normalizeCandles(rows, spec.seconds);
  if (rows.length > 0 && dropped > rows.length / 2)
    invalid("Most OHLCV rows failed validation.");
  return {
    pool,
    interval,
    candles,
    gaps,
    provenance: {
      source: SOURCE,
      chainId: token.chainId,
      token: token.address,
      poolId: pool,
      retrievedAt: Date.now(),
      observedAt: candles.length ? candles.at(-1)!.time * 1000 : undefined,
    },
  };
}

export function normalizeGeckoTrade(
  token: TokenRef,
  record: unknown,
): MarketTrade | "anomalous" | null {
  const item = asObject(record);
  const a: Json | null = asObject(item?.attributes);
  if (!item || !a) return null;
  if (a.is_anomalous === true) return "anomalous";
  const txHash = asTxHash(a.tx_hash);
  const blockNumber = asCount(a.block_number);
  const time = asTimestampMs(a.block_timestamp);
  const kind = a.kind === "buy" || a.kind === "sell" ? a.kind : null;
  const to = asAddress(a.to_token_address);
  const from = asAddress(a.from_token_address);
  if (!txHash || blockNumber === null || time === null || !kind) return null;
  const tracked = token.address.toLowerCase();
  // A buy receives the tracked token; a sell sends it.
  const receives = to?.toLowerCase() === tracked;
  const sends = from?.toLowerCase() === tracked;
  if ((kind === "buy" && !receives) || (kind === "sell" && !sends)) return null;
  const tokenAmount = asAmount(
    kind === "buy" ? a.to_token_amount : a.from_token_amount,
  );
  if (!tokenAmount) return null;
  return {
    id: asLabel(item.id, 200) ?? `${txHash}-${blockNumber}`,
    txHash,
    blockNumber,
    time,
    side: kind,
    tokenAmount,
    priceUsd: asAmount(
      kind === "buy" ? a.price_to_in_usd : a.price_from_in_usd,
    ),
    volumeUsd: asAmount(a.volume_in_usd),
    trader: asAddress(a.tx_from_address),
  };
}

/** Recent swaps in the pool (GeckoTerminal returns up to 300, last 24 h). */
export async function fetchGeckoTrades(
  token: TokenRef,
  poolId: Hex,
  options?: MarketFetchOptions,
): Promise<TradeList & { hiddenAnomalous: number }> {
  const pool = asPoolId(poolId);
  if (!pool) throw new MarketDataError("INVALID_INPUT", { source: SOURCE });
  const body = asObject(
    await getProviderJson(
      SOURCE,
      `${networkPath(token)}/pools/${pool}/trades?token=${token.address.toLowerCase()}`,
      HEADERS,
      options,
    ),
  );
  const data = asArray(body?.data);
  if (!data) invalid("The trades response has no data array.");
  let hiddenAnomalous = 0;
  const seen = new Set<string>();
  const trades: MarketTrade[] = [];
  for (const record of data) {
    const trade = normalizeGeckoTrade(token, record);
    if (trade === "anomalous") hiddenAnomalous += 1;
    else if (trade && !seen.has(trade.id)) {
      seen.add(trade.id);
      trades.push(trade);
    }
  }
  trades.sort((a, b) => b.time - a.time || b.blockNumber - a.blockNumber);
  return {
    pool,
    trades,
    hiddenAnomalous,
    provenance: {
      source: SOURCE,
      chainId: token.chainId,
      token: token.address,
      poolId: pool,
      retrievedAt: Date.now(),
      observedAt: trades[0]?.time,
    },
  };
}
