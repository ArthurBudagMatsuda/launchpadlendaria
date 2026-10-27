import { describe, expect, it } from "vitest";
import { tokens } from "@/data/tokens";
import {
  filterTokens,
  generateHistory,
  tokenProvider,
} from "@/services/token-provider";
import {
  financialActionsEnabled,
  isSupportedChain,
  supportedChains,
} from "@/config/networks";
describe("demo token catalog", () => {
  it("has stable unique identities and no fake deployed addresses", () => {
    expect(new Set(tokens.map((t) => t.id)).size).toBe(tokens.length);
    expect(
      tokens.every(
        (t) =>
          t.isDemo && !t.contractAddress && t.launch.curve.source === "demo",
      ),
    ).toBe(true);
  });
  it("searches names and tickers case-insensitively and trims ticker prefixes", () => {
    expect(
      filterTokens(tokens, { search: " orbit CAT " }).map((t) => t.id),
    ).toEqual(["orbit"]);
    expect(filterTokens(tokens, { search: "$CaPy" }).map((t) => t.id)).toEqual([
      "capy",
    ]);
  });
  it("combines categories and search with an empty-result state", () => {
    expect(
      filterTokens(tokens, { search: "orbit", stage: "graduated" }),
    ).toEqual([]);
    expect(filterTokens(tokens, { stage: "graduating" })).toHaveLength(5);
  });
  it.each(["volume", "marketCap", "recent"] as const)(
    "sorts by %s without mutating the source",
    (sort) => {
      const before = tokens.map((t) => t.id);
      const found = filterTokens(tokens, { sort });
      const value = (t: (typeof tokens)[number]) =>
        sort === "volume"
          ? t.market.volume24h
          : sort === "marketCap"
            ? t.market.marketCap
            : Date.parse(t.launch.createdAt);
      expect(
        found.every((t, i) => i === 0 || value(found[i - 1]) >= value(t)),
      ).toBe(true);
      expect(tokens.map((t) => t.id)).toEqual(before);
    },
  );
  it("returns the same token and metrics on details and discovery", async () => {
    for (const token of await tokenProvider.list())
      expect(await tokenProvider.get(token.id)).toEqual(token);
    expect(await tokenProvider.get("missing")).toBeUndefined();
  });
  it("generates deterministic, positive history with distinct intervals", () => {
    const a = generateHistory(tokens[0], "1H");
    expect(a).toEqual(generateHistory(tokens[0], "1H"));
    expect(a).not.toEqual(generateHistory(tokens[0], "1W"));
    expect(
      a.every((p, i) => p.price > 0 && (i === 0 || p.time > a[i - 1].time)),
    ).toBe(true);
  });
  it("does not create activity for unknown tokens", async () => {
    expect(await tokenProvider.trades("missing")).toEqual([]);
    expect(await tokenProvider.history("missing", "1H")).toEqual([]);
    expect((await tokenProvider.trades("orbit")).every((t) => t.isDemo)).toBe(
      true,
    );
  });
});
describe("Base-only read-only foundation", () => {
  it("only supports the two requested chain definitions", () => {
    expect(supportedChains.map((c) => c.id)).toEqual([84532, 8453]);
    expect(
      supportedChains.every((c) => c.nativeCurrency.symbol === "ETH"),
    ).toBe(true);
    expect(isSupportedChain(1)).toBe(false);
    expect(isSupportedChain(8453)).toBe(true);
    expect(financialActionsEnabled).toBe(false);
  });
});
