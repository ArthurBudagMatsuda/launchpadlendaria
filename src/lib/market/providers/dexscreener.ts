import { getProviderJson, type MarketFetchOptions } from "../http";
import { MarketDataError } from "../errors";
import { marketNetwork, quoteKind } from "../networks";
import type { DexProtocol, PoolMarket, TokenRef } from "../types";
import {
  asAddress,
  asAmount,
  asArray,
  asFiniteNumber,
  asLabel,
  asObject,
  asPoolId,
  asString,
  asTimestampMs,
  txCounts,
  windowed,
} from "../validate";

/**
 * DEX Screener public API (https://docs.dexscreener.com/api/reference).
 * No key, CORS enabled, 300 requests a minute for token/pair lookups. Used as
 * the fallback for pools and statistics; it has no OHLCV or trade history.
 */
const SOURCE = "dexscreener" as const;
const HEADERS = { Accept: "application/json" };

export function dexscreenerProtocol(
  dexId: string,
  labels: string[],
): DexProtocol {
  const dex = dexId.toLowerCase();
  if (dex === "uniswap") {
    if (labels.includes("v4")) return "uniswap-v4";
    if (labels.includes("v3")) return "uniswap-v3";
    if (labels.includes("v2")) return "uniswap-v2";
  }
  if (dex === "aerodrome" || dex === "aero") return "aerodrome";
  return "unknown";
}

export function normalizeDexscreenerPair(
  token: TokenRef,
  record: unknown,
  retrievedAt: number,
): PoolMarket | null {
  const pair = asObject(record);
  if (!pair) return null;
  if (asString(pair.chainId) !== marketNetwork(token.chainId).dexscreener)
    return null;
  const id = asPoolId(pair.pairAddress);
  const base = asObject(pair.baseToken);
  const quote = asObject(pair.quoteToken);
  const baseAddress = asAddress(base?.address);
  const quoteAddress = asAddress(quote?.address);
  if (!id || !baseAddress || !quoteAddress) return null;
  const dex = asLabel(pair.dexId, 60) ?? "unknown";
  const labels = (asArray(pair.labels) ?? [])
    .map((label) => asLabel(label, 20))
    .filter((label): label is string => label !== null);
  const keys = { m5: "m5", h1: "h1", h6: "h6", h24: "h24" } as const;
  const txns = asObject(pair.txns);
  return {
    pool: {
      chainId: token.chainId,
      id,
      dex,
      protocol: dexscreenerProtocol(dex, labels),
      label: labels.join(" ") || undefined,
      baseToken: {
        address: baseAddress,
        symbol: asLabel(base?.symbol, 32) ?? "?",
      },
      quoteToken: {
        address: quoteAddress,
        symbol: asLabel(quote?.symbol, 32) ?? "?",
        kind: quoteKind(token.chainId, quoteAddress),
      },
      createdAt: asTimestampMs(pair.pairCreatedAt) ?? undefined,
    },
    priceUsd: asAmount(pair.priceUsd),
    priceQuote: asAmount(pair.priceNative),
    liquidityUsd: asAmount(asObject(pair.liquidity)?.usd),
    volumeUsd: windowed(pair.volume, keys, asAmount),
    priceChangePct: windowed(pair.priceChange, keys, asFiniteNumber),
    txns: { h1: txCounts(txns?.h1), h24: txCounts(txns?.h24) },
    provenance: {
      source: SOURCE,
      chainId: token.chainId,
      token: token.address,
      poolId: id,
      retrievedAt,
    },
  };
}

/** Pairs DEX Screener lists for the token on Base (as base or quote). */
export async function fetchDexscreenerPools(
  token: TokenRef,
  options?: MarketFetchOptions,
): Promise<PoolMarket[]> {
  const chain = marketNetwork(token.chainId).dexscreener;
  const body = await getProviderJson(
    SOURCE,
    `/tokens/v1/${chain}/${token.address}`,
    HEADERS,
    options,
  );
  const pairs = asArray(body);
  if (!pairs)
    throw new MarketDataError("INVALID_RESPONSE", {
      source: SOURCE,
      message: "The token response is not a list of pairs.",
    });
  const retrievedAt = Date.now();
  return pairs
    .map((pair) => normalizeDexscreenerPair(token, pair, retrievedAt))
    .filter((pool): pool is PoolMarket => pool !== null);
}
