import { describe, expect, it } from "vitest";
import {
  compareDecimal,
  fromUnits,
  multiply,
  parseDecimal,
  parseNonNegativeDecimal,
  toDecimalString,
} from "@/lib/market/decimal";
import {
  computeFdvUsd,
  freshness,
  tokenAmount,
  valueUsd,
} from "@/lib/market/metrics";
import { normalizeCandles } from "@/lib/market/providers/geckoterminal";
import { rowsWithGaps } from "@/components/market/candle-chart";
import {
  quotePrice,
  tokenAmount as formatAmount,
  usdAmount,
  usdPrice,
} from "@/lib/format";

describe("exact decimals", () => {
  it("parses provider strings and numbers, including exponents", () => {
    expect(toDecimalString(parseDecimal("0.001826368907")!)).toBe(
      "0.001826368907",
    );
    expect(toDecimalString(parseDecimal(4.368e-9)!)).toBe("0.000000004368");
    expect(toDecimalString(parseDecimal("1e3")!)).toBe("1000");
    expect(toDecimalString(parseDecimal(" 190930.2863 ")!)).toBe("190930.2863");
    expect(toDecimalString(parseDecimal("-5.92")!)).toBe("-5.92");
  });

  it("rejects malformed, non-finite and negative-where-forbidden values", () => {
    for (const bad of [
      "",
      "abc",
      "1.2.3",
      "0x10",
      NaN,
      Infinity,
      null,
      {},
      "1".repeat(200),
    ])
      expect(parseDecimal(bad)).toBeNull();
    expect(parseNonNegativeDecimal("-1")).toBeNull();
    expect(parseNonNegativeDecimal("0")).not.toBeNull();
  });

  it("multiplies without floating-point error", () => {
    // 0.1 × 0.2 is 0.020000000000000004 in floating point.
    expect(
      toDecimalString(multiply(parseDecimal("0.1")!, parseDecimal("0.2")!)),
    ).toBe("0.02");
    expect(compareDecimal(parseDecimal("10.50")!, parseDecimal("10.5")!)).toBe(
      0,
    );
    expect(
      compareDecimal(parseDecimal("0.0001")!, parseDecimal("0.00009")!),
    ).toBe(1);
  });

  it("converts raw token units with the token's decimals", () => {
    expect(toDecimalString(fromUnits(10n ** 27n, 18))).toBe("1000000000");
    expect(toDecimalString(fromUnits(1_500_000n, 6))).toBe("1.5");
    expect(toDecimalString(fromUnits(1n, 18))).toBe("0.000000000000000001");
    expect(tokenAmount(123_456_789n, 0)).toBe("123456789");
  });
});

describe("market metrics", () => {
  it("computes FDV from on-chain supply and the pool price, exactly", () => {
    // 1,000,000,000 worth × $0.001826368907 = $1,826,368.907
    expect(computeFdvUsd(10n ** 27n, 18, "0.001826368907")).toBe("1826368.9");
    expect(computeFdvUsd(10n ** 27n, 18, "0.0018263689079")).toBe("1826368.9");
    expect(computeFdvUsd(2_000_000n, 6, "1.25")).toBe("2.5");
  });

  it("returns no FDV when supply, decimals or price is missing", () => {
    expect(computeFdvUsd(null, 18, "1")).toBeNull();
    expect(computeFdvUsd(10n, null, "1")).toBeNull();
    expect(computeFdvUsd(10n, 18, null)).toBeNull();
    expect(computeFdvUsd(10n, 18, "not a number")).toBeNull();
  });

  it("values a balance at a price, or not at all", () => {
    expect(valueUsd("18985.365382667", "0.00182617527286454")).toBe("34.67");
    expect(valueUsd("1", null)).toBeNull();
  });

  it("calls data stale after two missed refreshes", () => {
    expect(freshness(1_000, 60_000, 100_000)).toBe("live");
    expect(freshness(1_000, 60_000, 121_001)).toBe("stale");
  });
});

describe("price formatting", () => {
  it("keeps significant digits for tiny prices and cents for large ones", () => {
    expect(usdPrice("0.001826368907")).toBe("$0.001826");
    expect(usdPrice("2355.33")).toBe("$2,355.33");
    expect(usdPrice("0.000000000000000000000000000000000000000006574")).toBe(
      "$6.574E-42",
    );
    expect(quotePrice("0.0000007750477017", "ETH")).toBe("0.000000775 ETH");
    expect(usdAmount("190930.2863")).toBe("$190.93K");
    expect(formatAmount("18985.365382667")).toBe("18.99K");
  });
});

describe("OHLCV normalization", () => {
  const H = 3600;
  const T = 1_793_145_600; // 2026-10-28T00:00:00Z
  it("orders candles oldest first, removes duplicates and counts gaps", () => {
    const rows = [
      [T + 10 * H, 3, 4, 2, 3.5, 10],
      [T + 10 * H, 9, 9, 9, 9, 1], // duplicate bucket (older version)
      [T + 7 * H, 1, 2, 0.5, 1.5, 20],
      [T + 8 * H, 1.5, 3, 1.4, 3, 5],
    ];
    const { candles, gaps, dropped } = normalizeCandles(rows, H);
    expect(candles.map((c) => c.time)).toEqual([
      T + 7 * H,
      T + 8 * H,
      T + 10 * H,
    ]);
    expect(candles[2].close).toBe(3.5); // the first (newest) version wins
    expect(gaps).toBe(1); // 9h has no observation
    expect(dropped).toBe(1);
  });

  it("drops impossible candles instead of drawing them", () => {
    const rows = [
      [T + H, 1, 0.5, 0.4, 1, 1], // high below open
      [T + 2 * H, 1, 2, 1.5, 1.2, 1], // low above close
      [T + 3 * H, -1, 2, -2, 1, 1], // negative prices
      [T + 4 * H, 1, 2, 0.5, 1.5, -3], // negative volume
      [T + 5 * H + 7, 1, 2, 0.5, 1.5, 3], // not aligned to the interval
      ["x", 1, 2, 0.5, 1.5, 3], // malformed timestamp
      [3600, 1, 2, 0.5, 1.5, 3], // before Base existed
      [T + 6 * H, 1, 2, 0.5, 1.5, 3], // valid
    ];
    const { candles, dropped } = normalizeCandles(rows, H);
    expect(candles.map((c) => c.time)).toEqual([T + 6 * H]);
    expect(dropped).toBe(7);
  });

  it("keeps real gaps empty in the chart rows (no interpolation)", () => {
    const candle = (time: number) => ({
      time,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volumeUsd: 1,
    });
    const rows = rowsWithGaps([candle(T), candle(T + 3 * H)], H);
    expect(rows.map((r) => r.time)).toEqual([T, T + H, T + 2 * H, T + 3 * H]);
    expect(rows.filter((r) => r.candle === null)).toHaveLength(2);
    expect(rows[1]).toMatchObject({ close: null, range: null, volume: null });
  });
});
