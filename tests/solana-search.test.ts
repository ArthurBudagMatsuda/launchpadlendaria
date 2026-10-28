import { describe, expect, it } from "vitest";
import {
  matchesSearch,
  sortRows,
  type TokenRow,
} from "@/lib/market/solana-token-search";
import { parseAddress } from "@/lib/solana/address";
const row: TokenRow = {
  asset: {
    slug: "test-only",
    cluster: "devnet",
    address: parseAddress("So11111111111111111111111111111111111111112")!,
    relation: "external-tracked",
    status: "active",
    primaryPool: null,
    verification: {
      name: "Test Fixture",
      symbol: "TEST",
      checkedAt: "test",
      evidence: "test only",
    },
  },
};
describe("mint search", () => {
  it("preserves case in mint and prefix matching", () => {
    expect(matchesSearch(row, "So111111")).toBe(true);
    expect(matchesSearch(row, "so111111")).toBe(false);
    expect(matchesSearch(row, row.asset.address.toLowerCase())).toBe(false);
  });
  it("still searches names and tickers without case sensitivity", () => {
    expect(matchesSearch(row, "test fixture")).toBe(true);
    expect(matchesSearch(row, " $tEsT ")).toBe(true);
  });
  it("does not mutate rows while sorting or invent a value for unknown markets", () => {
    const rows = [row];
    expect(sortRows(rows, "liquidity")).toEqual(rows);
    expect(sortRows(rows, "volume")).not.toBe(rows);
  });
});
