import type { TrackedAsset } from "@/config/tracked-mints";
import type { MintFacts } from "@/lib/solana/rpc";
import type { SolanaMarket } from "./solana-market";
import { compareDecimal, parseDecimal } from "./decimal";
export type TokenSort = "liquidity" | "volume";
export interface TokenRow {
  asset: TrackedAsset;
  facts?: MintFacts;
  market?: SolanaMarket;
}
export function matchesSearch(row: TokenRow, search: string) {
  const original = search.trim();
  if (!original) return true;
  if (row.asset.address.startsWith(original)) return true;
  const term = original.toLowerCase().replace(/^\$/, "");
  return `${row.facts?.name ?? row.asset.verification.name} ${row.facts?.symbol ?? row.asset.verification.symbol}`
    .toLowerCase()
    .includes(term);
}
export function sortRows(rows: TokenRow[], sort: TokenSort) {
  const metric = (row: TokenRow) =>
    parseDecimal(
      sort === "liquidity"
        ? row.market?.selection.primary?.liquidityUsd
        : row.market?.selection.primary?.volumeUsd.h24,
    );
  return [...rows].sort((a, b) => {
    const x = metric(a),
      y = metric(b);
    if (x && y && compareDecimal(x, y) !== 0) return compareDecimal(y, x);
    if (x && !y) return -1;
    if (y && !x) return 1;
    return a.asset.address < b.asset.address
      ? -1
      : a.asset.address > b.asset.address
        ? 1
        : 0;
  });
}
