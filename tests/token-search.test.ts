import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { FEATURED_ASSET, type TrackedAsset } from "@/config/featured-assets";
import type { TokenMarket } from "@/lib/market/market-service";
import {
  matchesSearch,
  sortRows,
  type TokenRow,
} from "@/lib/market/token-search";

const featured = FEATURED_ASSET!;
// A second, made-up asset only to exercise ordering.
const other: TrackedAsset = {
  ...featured,
  address: getAddress("0x1000000000000000000000000000000000000001"),
  slug: "0x1000000000000000000000000000000000000001",
  verification: { ...featured.verification, name: "Other", symbol: "OTH" },
};
const market = (liquidityUsd: string | null, volume24: string | null) =>
  ({
    selection: {
      primary: {
        liquidityUsd,
        volumeUsd: { m5: null, h1: null, h6: null, h24: volume24 },
      },
    },
  }) as unknown as TokenMarket;

describe("Discover search", () => {
  const row: TokenRow = { asset: featured };
  it("matches name, ticker (with or without $) and case-insensitively", () => {
    for (const term of ["worth", "WORTH", "$worth", "its worth an", "  life "])
      expect(matchesSearch(row, term), term).toBe(true);
    expect(matchesSearch(row, "orbit")).toBe(false);
    expect(matchesSearch(row, "")).toBe(true);
  });

  it("matches a contract address by prefix of at least 4 characters", () => {
    expect(matchesSearch(row, featured.address)).toBe(true);
    expect(matchesSearch(row, featured.address.toLowerCase())).toBe(true);
    expect(matchesSearch(row, "0xb200")).toBe(true);
    expect(matchesSearch(row, "0xb2")).toBe(true);
    expect(matchesSearch(row, "0xb")).toBe(false);
    expect(matchesSearch(row, "0x1111")).toBe(false);
  });

  it("prefers the on-chain name and symbol once they are read", () => {
    const renamed = {
      asset: featured,
      facts: { name: "Renamed Token", symbol: "RNM" },
    } as unknown as TokenRow;
    expect(matchesSearch(renamed, "renamed")).toBe(true);
    expect(matchesSearch(renamed, "worth")).toBe(false);
  });
});

describe("Discover sorting", () => {
  it("sorts by exact liquidity or volume, missing values last", () => {
    const rows: TokenRow[] = [
      { asset: other, market: market("9.99", "500") },
      { asset: featured, market: market("10.00", "20") },
    ];
    expect(
      sortRows(rows, "liquidity").map((r) => r.asset.verification.symbol),
    ).toEqual(["worth", "OTH"]);
    expect(
      sortRows(rows, "volume").map((r) => r.asset.verification.symbol),
    ).toEqual(["OTH", "worth"]);
    const missing: TokenRow[] = [
      { asset: featured },
      { asset: other, market: market("1", "1") },
    ];
    expect(sortRows(missing, "liquidity")[0].asset).toBe(other);
  });

  it("breaks ties by address so the order is stable", () => {
    const rows: TokenRow[] = [{ asset: featured }, { asset: other }];
    expect(sortRows(rows, "liquidity").map((r) => r.asset.address)).toEqual([
      other.address,
      featured.address,
    ]);
  });
});
