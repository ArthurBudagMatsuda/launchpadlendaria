import type { Hex } from "viem";
import { compareDecimal, parseDecimal } from "./decimal";
import type { PoolMarket, TokenRef } from "./types";

/**
 * Primary-pool policy. Pools are never summed or averaged: one pool is chosen
 * and every price, liquidity and volume figure on the page is that pool's.
 *
 * A pool is eligible when it is on the token's chain, lists the token as its
 * base asset, is priced against native ETH, WETH or USDC, reports at least
 * MIN_LIQUIDITY_USD of liquidity and had trades in the last 24 hours. Eligible
 * pools rank by reported liquidity, then 24 h volume, then pool ID (so the
 * order is deterministic). A pinned pool from the featured-asset config wins
 * while it stays eligible; when it does not, the ranked choice is used and the
 * reason says so, which keeps a primary-pool change visible.
 */
export const MIN_LIQUIDITY_USD = "1000";

export type ExclusionReason =
  | "other-chain"
  | "token-not-base"
  | "unsupported-quote"
  | "no-price"
  | "low-liquidity"
  | "no-recent-trades";

export type SelectionReason =
  | "pinned"
  | "ranked"
  | "pinned-missing"
  | "pinned-ineligible"
  | "none-eligible";

export interface PoolSelection {
  primary: PoolMarket | null;
  eligible: PoolMarket[];
  excluded: { pool: PoolMarket; reason: ExclusionReason }[];
  reason: SelectionReason;
  pinnedPoolId?: Hex;
}

export function exclusionReason(
  token: TokenRef,
  market: PoolMarket,
): ExclusionReason | null {
  const { pool } = market;
  if (pool.chainId !== token.chainId) return "other-chain";
  if (pool.baseToken.address.toLowerCase() !== token.address.toLowerCase())
    return "token-not-base";
  if (pool.quoteToken.kind === "other") return "unsupported-quote";
  if (!market.priceUsd || parseDecimal(market.priceUsd)?.units === 0n)
    return "no-price";
  const liquidity = parseDecimal(market.liquidityUsd);
  const minimum = parseDecimal(MIN_LIQUIDITY_USD)!;
  if (!liquidity || compareDecimal(liquidity, minimum) < 0)
    return "low-liquidity";
  const trades = market.txns.h24;
  if (!trades || trades.buys + trades.sells === 0) return "no-recent-trades";
  return null;
}

function rank(a: PoolMarket, b: PoolMarket) {
  const liquidity = compareDecimal(
    parseDecimal(b.liquidityUsd)!,
    parseDecimal(a.liquidityUsd)!,
  );
  if (liquidity) return liquidity;
  const volume = compareDecimal(
    parseDecimal(b.volumeUsd.h24 ?? "0")!,
    parseDecimal(a.volumeUsd.h24 ?? "0")!,
  );
  if (volume) return volume;
  return a.pool.id < b.pool.id ? -1 : a.pool.id > b.pool.id ? 1 : 0;
}

export function selectPrimaryPool(
  token: TokenRef,
  pools: PoolMarket[],
  pinnedPoolId?: Hex,
): PoolSelection {
  const eligible: PoolMarket[] = [];
  const excluded: PoolSelection["excluded"] = [];
  const seen = new Set<string>();
  for (const market of pools) {
    if (seen.has(market.pool.id)) continue;
    seen.add(market.pool.id);
    const reason = exclusionReason(token, market);
    if (reason) excluded.push({ pool: market, reason });
    else eligible.push(market);
  }
  eligible.sort(rank);
  const pinned = pinnedPoolId?.toLowerCase();
  const pinnedEligible = pinned
    ? eligible.find((m) => m.pool.id === pinned)
    : undefined;
  if (pinnedEligible)
    return {
      primary: pinnedEligible,
      eligible,
      excluded,
      reason: "pinned",
      pinnedPoolId,
    };
  const primary = eligible[0] ?? null;
  const reason: SelectionReason = !primary
    ? "none-eligible"
    : !pinned
      ? "ranked"
      : excluded.some((e) => e.pool.pool.id === pinned)
        ? "pinned-ineligible"
        : "pinned-missing";
  return { primary, eligible, excluded, reason, pinnedPoolId };
}
