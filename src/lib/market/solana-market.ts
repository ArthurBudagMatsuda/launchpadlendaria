import { parseAddress, type SolanaAddress } from "@/lib/solana/address";
import type { SolanaCluster } from "@/config/solana";
import { getProviderJson, type MarketFetchOptions } from "./http";
import { MarketDataError } from "./errors";
import { compareDecimal, parseDecimal } from "./decimal";
import type {
  Candle,
  CandleInterval,
  CandleSeries,
  MarketSourceId,
  MarketTrade,
  PoolMarket,
  TokenRef,
  TradeList,
} from "./types";
const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export function safeLabel(v: unknown, max = 64) {
  return typeof v === "string"
    ? v
        .replace(
          /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,
          "",
        )
        .trim()
        .slice(0, max)
    : "";
}
function amount(v: unknown) {
  const p = parseDecimal(v);
  return p && p.units >= 0n ? (typeof v === "string" ? v : String(v)) : null;
}
function number(v: unknown) {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim()
        ? Number(v)
        : NaN;
  return Number.isFinite(n) ? n : null;
}
function count(v: unknown) {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
}
function counts(v: unknown) {
  const a = obj(v);
  const buys = count(a.buys),
    sells = count(a.sells);
  return buys !== null && sells !== null ? { buys, sells } : null;
}
function windows<T>(v: unknown, fn: (v: unknown) => T | null) {
  const a = obj(v);
  return { m5: fn(a.m5), h1: fn(a.h1), h6: fn(a.h6), h24: fn(a.h24) };
}
function protocol(dex: string) {
  return dex.includes("raydium")
    ? ("raydium" as const)
    : dex.includes("meteora")
      ? ("meteora" as const)
      : ("unknown" as const);
}
function mainnet(cluster: SolanaCluster) {
  if (cluster !== "mainnet-beta")
    throw new MarketDataError("UNSUPPORTED_CHAIN", {
      message:
        "Market providers index Solana Mainnet. No Mainnet data is substituted for Devnet.",
    });
}
const WSOL = "So11111111111111111111111111111111111111112";
export function normalizeSolanaPair(
  token: TokenRef,
  raw: unknown,
  source: MarketSourceId,
  retrievedAt = Date.now(),
): PoolMarket | null {
  mainnet(token.cluster);
  const item = obj(raw),
    a = source === "geckoterminal" ? obj(item.attributes) : item;
  const rel = obj(item.relationships);
  const relationship = (key: string) => {
    const id = obj(obj(rel[key]).data).id;
    return typeof id === "string" && id.startsWith("solana_")
      ? parseAddress(id.slice(7))
      : null;
  };
  if (source === "dexscreener" && item.chainId !== "solana") return null;
  const id = parseAddress(
    source === "geckoterminal" ? a.address : a.pairAddress,
  );
  const base =
    source === "geckoterminal"
      ? relationship("base_token")
      : parseAddress(obj(a.baseToken).address);
  const quote =
    source === "geckoterminal"
      ? relationship("quote_token")
      : parseAddress(obj(a.quoteToken).address);
  if (!id || !base || !quote || base !== token.address) return null;
  const dex = safeLabel(
    source === "geckoterminal" ? obj(obj(rel.dex).data).id : a.dexId,
    60,
  ).toLowerCase();
  const tx = obj(source === "geckoterminal" ? a.transactions : a.txns);
  return {
    pool: {
      cluster: token.cluster,
      id,
      dex,
      protocol: protocol(dex),
      baseToken: {
        address: base,
        symbol: safeLabel(obj(a.baseToken).symbol, 32) || "Token",
      },
      quoteToken: {
        address: quote,
        symbol:
          quote === WSOL
            ? "WSOL"
            : safeLabel(obj(a.quoteToken).symbol, 32) || "Quote",
        kind: quote === WSOL ? "wsol" : "other",
      },
    },
    priceUsd: amount(
      source === "geckoterminal" ? a.base_token_price_usd : a.priceUsd,
    ),
    priceQuote: amount(
      source === "geckoterminal"
        ? a.base_token_price_quote_token
        : a.priceNative,
    ),
    liquidityUsd: amount(
      source === "geckoterminal" ? a.reserve_in_usd : obj(a.liquidity).usd,
    ),
    volumeUsd: windows(
      source === "geckoterminal" ? a.volume_usd : a.volume,
      amount,
    ),
    priceChangePct: windows(
      source === "geckoterminal" ? a.price_change_percentage : a.priceChange,
      number,
    ),
    txns: { h1: counts(tx.h1), h24: counts(tx.h24) },
    provenance: {
      source,
      cluster: token.cluster,
      token: token.address,
      poolId: id,
      retrievedAt,
    },
  };
}
export function selectSolanaPool(
  token: TokenRef,
  pools: PoolMarket[],
  pinned?: SolanaAddress,
) {
  const eligible = [
    ...new Map(
      pools
        .filter((p) => {
          const price = parseDecimal(p.priceUsd),
            liquidity = parseDecimal(p.liquidityUsd);
          return (
            p.pool.cluster === token.cluster &&
            p.pool.baseToken.address === token.address &&
            price &&
            price.units > 0n &&
            liquidity &&
            compareDecimal(liquidity, parseDecimal("1000")!) >= 0 &&
            p.txns.h24 &&
            p.txns.h24.buys + p.txns.h24.sells > 0
          );
        })
        .map((p) => [p.pool.id, p]),
    ).values(),
  ];
  eligible.sort(
    (a, b) =>
      compareDecimal(
        parseDecimal(b.liquidityUsd)!,
        parseDecimal(a.liquidityUsd)!,
      ) || (a.pool.id < b.pool.id ? -1 : 1),
  );
  return {
    primary: eligible.find((p) => p.pool.id === pinned) ?? eligible[0] ?? null,
    eligible,
  };
}
export interface SolanaMarket {
  token: TokenRef;
  source: MarketSourceId;
  fallbackUsed: boolean;
  pools: PoolMarket[];
  selection: ReturnType<typeof selectSolanaPool>;
  retrievedAt: number;
}
export async function loadSolanaMarket(
  token: TokenRef,
  options: MarketFetchOptions & { pinnedPoolId?: SolanaAddress } = {},
): Promise<SolanaMarket> {
  mainnet(token.cluster);
  let empty: SolanaMarket | undefined;
  for (const source of ["geckoterminal", "dexscreener"] as const) {
    try {
      const path =
        source === "geckoterminal"
          ? `/api/v2/networks/solana/tokens/${token.address}/pools?page=1`
          : `/tokens/v1/solana/${token.address}`;
      const response = await getProviderJson(
        source,
        path,
        { Accept: "application/json" },
        options,
      );
      const raw = source === "geckoterminal" ? obj(response).data : response;
      if (!Array.isArray(raw)) throw new Error("Invalid provider response.");
      const retrievedAt = Date.now();
      const pools = raw
        .map((value) => normalizeSolanaPair(token, value, source, retrievedAt))
        .filter((value): value is PoolMarket => value !== null);
      const result = {
        token,
        source,
        fallbackUsed: source === "dexscreener",
        pools,
        selection: selectSolanaPool(token, pools, options.pinnedPoolId),
        retrievedAt,
      };
      if (result.selection.primary) return result;
      empty ??= result;
    } catch {
      if (options.signal?.aborted) throw new Error("Market request canceled.");
    }
  }
  if (empty) return empty;
  throw new Error(
    "Solana market data unavailable. No estimated values are shown.",
  );
}
export const SOLANA_INTERVALS: Record<
  CandleInterval,
  { timeframe: string; aggregate: number; seconds: number }
> = {
  "5m": { timeframe: "minute", aggregate: 5, seconds: 300 },
  "15m": { timeframe: "minute", aggregate: 15, seconds: 900 },
  "1h": { timeframe: "hour", aggregate: 1, seconds: 3600 },
  "4h": { timeframe: "hour", aggregate: 4, seconds: 14400 },
  "1d": { timeframe: "day", aggregate: 1, seconds: 86400 },
};
export function normalizeCandles(rows: unknown[], intervalSeconds: number) {
  const byTime = new Map<number, Candle>();
  let dropped = 0;
  for (const row of rows) {
    const [time, open, high, low, close, volume] = list(row).map(number);
    if (
      time == null ||
      !Number.isSafeInteger(time) ||
      time * 1000 < Date.UTC(2020, 0, 1) ||
      time * 1000 > Date.now() + 86400000 ||
      time % intervalSeconds !== 0 ||
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      volume == null ||
      open <= 0 ||
      low <= 0 ||
      high < Math.max(open, close, low) ||
      low > Math.min(open, close) ||
      volume < 0 ||
      byTime.has(time)
    ) {
      dropped++;
      continue;
    }
    byTime.set(time, { time, open, high, low, close, volumeUsd: volume });
  }
  const candles = [...byTime.values()].sort((a, b) => a.time - b.time);
  let gaps = 0;
  for (let i = 1; i < candles.length; i++)
    gaps += (candles[i].time - candles[i - 1].time) / intervalSeconds - 1;
  return { candles, dropped, gaps };
}
export async function loadSolanaCandles(
  token: TokenRef,
  pool: SolanaAddress,
  interval: CandleInterval,
  options: MarketFetchOptions = {},
): Promise<CandleSeries> {
  mainnet(token.cluster);
  if (!parseAddress(pool)) throw new Error("Invalid pool address.");
  const spec = SOLANA_INTERVALS[interval];
  const response = obj(
    await getProviderJson(
      "geckoterminal",
      `/api/v2/networks/solana/pools/${pool}/ohlcv/${spec.timeframe}?aggregate=${spec.aggregate}&limit=365&currency=usd&token=${token.address}`,
      { Accept: "application/json" },
      options,
    ),
  );
  const base = parseAddress(obj(obj(response.meta).base).address);
  if (base !== token.address)
    throw new Error("Candle metadata does not match the requested mint.");
  const raw = obj(obj(response.data).attributes).ohlcv_list;
  if (!Array.isArray(raw)) throw new Error("Candles unavailable.");
  const normalized = normalizeCandles(raw, spec.seconds);
  if (raw.length && normalized.dropped > raw.length / 2)
    throw new Error("Candle validation failed.");
  return {
    pool,
    interval,
    candles: normalized.candles,
    gaps: normalized.gaps,
    provenance: {
      source: "geckoterminal",
      cluster: token.cluster,
      token: token.address,
      poolId: pool,
      retrievedAt: Date.now(),
    },
  };
}
export async function loadSolanaTrades(
  token: TokenRef,
  pool: SolanaAddress,
  options: MarketFetchOptions = {},
): Promise<TradeList> {
  mainnet(token.cluster);
  if (!parseAddress(pool)) throw new Error("Invalid pool address.");
  const response = obj(
    await getProviderJson(
      "geckoterminal",
      `/api/v2/networks/solana/pools/${pool}/trades?token=${token.address}`,
      { Accept: "application/json" },
      options,
    ),
  );
  if (!Array.isArray(response.data)) throw new Error("Activity unavailable.");
  const trades: MarketTrade[] = [];
  for (const raw of response.data) {
    const a = obj(obj(raw).attributes),
      signature = a.tx_hash,
      side = a.kind;
    if (
      a.is_anomalous === true ||
      typeof signature !== "string" ||
      !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature) ||
      (side !== "buy" && side !== "sell")
    )
      continue;
    if (
      (side === "buy" ? a.to_token_address : a.from_token_address) !==
      token.address
    )
      continue;
    const time =
      typeof a.block_timestamp === "string"
        ? Date.parse(a.block_timestamp)
        : NaN;
    const slot = count(a.block_number),
      tokenAmount = amount(
        side === "buy" ? a.to_token_amount : a.from_token_amount,
      );
    if (
      !Number.isFinite(time) ||
      time > Date.now() + 86400000 ||
      time < Date.UTC(2020, 0, 1) ||
      slot === null ||
      !tokenAmount
    )
      continue;
    trades.push({
      id:
        safeLabel(obj(raw).id, 240) ||
        `${signature}:${side}:${tokenAmount}:${time}`,
      signature,
      slot,
      time,
      side,
      tokenAmount,
      priceUsd: amount(
        side === "buy" ? a.price_to_in_usd : a.price_from_in_usd,
      ),
      volumeUsd: amount(a.volume_in_usd),
      trader: parseAddress(a.tx_from_address),
    });
  }
  return {
    pool,
    trades: [...new Map(trades.map((t) => [t.id, t])).values()].sort(
      (a, b) => b.time - a.time,
    ),
    provenance: {
      source: "geckoterminal",
      cluster: token.cluster,
      token: token.address,
      poolId: pool,
      retrievedAt: Date.now(),
    },
  };
}
