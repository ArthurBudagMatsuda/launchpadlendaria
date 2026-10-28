import type { TrackedAsset } from "@/config/featured-assets";
import type { DexProtocol, PoolMarket } from "@/lib/market/types";

export const PROTOCOL_NAMES: Record<DexProtocol, string> = {
  "uniswap-v2": "Uniswap v2",
  "uniswap-v3": "Uniswap v3",
  "uniswap-v4": "Uniswap v4",
  aerodrome: "Aerodrome",
  unknown: "DEX",
};

export function poolLabel(market: PoolMarket, asset?: TrackedAsset) {
  const protocol =
    asset?.primaryPool?.id === market.pool.id
      ? asset.primaryPool.protocol
      : market.pool.protocol;
  return {
    pair: `${market.pool.baseToken.symbol}/${market.pool.quoteToken.symbol}`,
    venue:
      protocol === "unknown"
        ? market.pool.dex
        : `${PROTOCOL_NAMES[protocol]}${market.pool.label && !market.pool.label.startsWith("v") ? ` · ${market.pool.label}` : ""}`,
  };
}
