import type { TrackedAsset } from "@/config/featured-assets";
import { compareDecimal, parseDecimal } from "./decimal";
import type { TokenMarket } from "./market-service";
import type { OnchainTokenFacts } from "./onchain";

export type TokenSort = "liquidity" | "volume";

/** A tracked token with whatever on-chain and market data has loaded. */
export interface TokenRow {
  asset: TrackedAsset;
  facts?: OnchainTokenFacts;
  market?: TokenMarket;
}

/**
 * Search by contract address (full or prefix), name or ticker. Names and
 * tickers come from Base RPC once read, else from the verified snapshot.
 */
export function matchesSearch(row: TokenRow, search: string) {
  const term = search.trim().toLowerCase().replace(/^\$/, "");
  if (!term) return true;
  if (/^0x[0-9a-f]*$/.test(term))
    return term.length >= 4 && row.asset.address.toLowerCase().startsWith(term);
  const name = row.facts?.name ?? row.asset.verification.name;
  const symbol = row.facts?.symbol ?? row.asset.verification.symbol;
  return `${name} ${symbol}`.toLowerCase().includes(term);
}

/** Tokens without the metric sort last; ties break on address, so order is stable. */
export function sortRows(rows: TokenRow[], sort: TokenSort) {
  const metric = (row: TokenRow) => {
    const primary = row.market?.selection.primary;
    return parseDecimal(
      sort === "liquidity" ? primary?.liquidityUsd : primary?.volumeUsd.h24,
    );
  };
  return [...rows].sort((a, b) => {
    const x = metric(a);
    const y = metric(b);
    if (x && y && compareDecimal(x, y) !== 0) return compareDecimal(y, x);
    if (x && !y) return -1;
    if (!x && y) return 1;
    return a.asset.address.toLowerCase() < b.asset.address.toLowerCase()
      ? -1
      : 1;
  });
}
