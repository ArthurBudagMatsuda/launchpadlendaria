import {
  fromUnits,
  multiply,
  parseNonNegativeDecimal,
  toDecimalString,
} from "./decimal";

/**
 * Fully diluted valuation = on-chain totalSupply (raw units, bigint) ×
 * primary-pool USD price, computed exactly. This is FDV, not market cap:
 * circulating supply is not established for any tracked token, so market
 * cap is reported as unavailable instead of being approximated.
 */
export function computeFdvUsd(
  totalSupply: bigint | null,
  decimals: number | null,
  priceUsd: string | null,
): string | null {
  if (totalSupply === null || decimals === null || priceUsd === null)
    return null;
  if (totalSupply < 0n || !Number.isInteger(decimals) || decimals < 0)
    return null;
  const price = parseNonNegativeDecimal(priceUsd);
  if (!price) return null;
  return toDecimalString(multiply(fromUnits(totalSupply, decimals), price), 2);
}

/** Human amount of a raw token balance, exact. */
export function tokenAmount(raw: bigint, decimals: number): string {
  return toDecimalString(fromUnits(raw, decimals));
}

/** USD value of a token amount at a price (both exact decimal strings). */
export function valueUsd(amount: string, priceUsd: string | null) {
  if (!priceUsd) return null;
  const a = parseNonNegativeDecimal(amount);
  const p = parseNonNegativeDecimal(priceUsd);
  return a && p ? toDecimalString(multiply(a, p), 2) : null;
}

export type Freshness = "live" | "stale";

/**
 * A figure is live while its last successful fetch is younger than twice the
 * refresh interval (one missed poll is tolerated). Older data stays on screen
 * only when labeled stale with its timestamp.
 */
export function freshness(
  retrievedAt: number,
  refreshMs: number,
  now = Date.now(),
): Freshness {
  return now - retrievedAt <= refreshMs * 2 ? "live" : "stale";
}
