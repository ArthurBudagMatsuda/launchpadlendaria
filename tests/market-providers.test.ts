import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { MarketDataError } from "@/lib/market/errors";
import { getProviderJson } from "@/lib/market/http";
import { loadTokenMarket } from "@/lib/market/market-service";
import { selectPrimaryPool } from "@/lib/market/pool-selection";
import { fetchDexscreenerPools } from "@/lib/market/providers/dexscreener";
import {
  fetchGeckoCandles,
  fetchGeckoPools,
  fetchGeckoTrades,
} from "@/lib/market/providers/geckoterminal";
import {
  DUST_POOL,
  IMPOSTOR,
  IMPOSTOR_POOL,
  jsonResponse,
  marketFetch,
  PRIMARY_POOL,
  USDC_POOL,
  WORTH,
  dexscreenerPairsResponse,
  geckoOhlcvResponse,
  geckoPoolsResponse,
} from "./fixtures/market-responses";

const token = { chainId: 8453, address: WORTH };
const pinned = PRIMARY_POOL as Hex;

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as MarketDataError;
  }
  throw new Error("expected a rejection");
}

describe("GeckoTerminal adapter", () => {
  it("normalizes pools with identity, quote kind and exact values", async () => {
    const pools = await fetchGeckoPools(token, { fetch: marketFetch().fetch });
    const primary = pools.find((p) => p.pool.id === PRIMARY_POOL)!;
    expect(primary.pool).toMatchObject({
      chainId: 8453,
      dex: "o1-launchpad",
      baseToken: { address: WORTH, symbol: "worth" },
      quoteToken: { symbol: "ETH", kind: "native-eth" },
    });
    expect(primary.priceUsd).toBe("0.001826368907");
    expect(primary.priceQuote).toBe("0.0000007750477017");
    expect(primary.liquidityUsd).toBe("190930.2863");
    expect(primary.txns.h24).toEqual({ buys: 2217, sells: 2050 });
    expect(primary.provenance).toMatchObject({
      source: "geckoterminal",
      chainId: 8453,
      poolId: PRIMARY_POOL,
    });
    const usdc = pools.find((p) => p.pool.id === USDC_POOL)!;
    expect(usdc.pool).toMatchObject({
      protocol: "uniswap-v4",
      label: "5%",
      quoteToken: { kind: "usdc" },
    });
  });

  it("skips records with a malformed identity instead of guessing", async () => {
    const broken = structuredClone(geckoPoolsResponse);
    broken.data[0].attributes.address = "not-a-pool";
    broken.data[1].relationships.base_token.data.id =
      "eth_0x0000000000000000000000000000000000000001";
    const pools = await fetchGeckoPools(token, {
      fetch: marketFetch({
        gecko: (u) =>
          u.pathname.endsWith("/pools") ? jsonResponse(broken) : undefined,
      }).fetch,
    });
    expect(pools.map((p) => p.pool.id)).not.toContain(PRIMARY_POOL);
    expect(pools.map((p) => p.pool.id)).not.toContain(USDC_POOL);
  });

  it("rejects a response without the expected shape", async () => {
    const error = await rejection(
      fetchGeckoPools(token, {
        fetch: marketFetch({ gecko: () => jsonResponse({ pools: [] }) }).fetch,
      }),
    );
    expect(error.code).toBe("INVALID_RESPONSE");
  });

  it("requests OHLCV priced for the tracked token and validates it", async () => {
    const { fetch, calls } = marketFetch();
    const series = await fetchGeckoCandles(token, pinned, "1h", { fetch });
    expect(calls[0]).toContain(`/pools/${PRIMARY_POOL}/ohlcv/hour?aggregate=1`);
    expect(calls[0]).toContain(`token=${WORTH.toLowerCase()}`);
    expect(series.candles.map((c) => c.time)).toEqual([
      1793145600, 1793152800, 1793156400,
    ]);
    expect(series.gaps).toBe(1);
    expect(series.provenance.observedAt).toBe(1793156400 * 1000);
  });

  it("refuses a series priced for the other side of the pair", async () => {
    const other = geckoOhlcvResponse();
    other.meta.base.address = IMPOSTOR.toLowerCase();
    const error = await rejection(
      fetchGeckoCandles(token, pinned, "1h", {
        fetch: marketFetch({
          gecko: (u) =>
            u.pathname.includes("/ohlcv/") ? jsonResponse(other) : undefined,
        }).fetch,
      }),
    );
    expect(error.code).toBe("INVALID_RESPONSE");
  });

  it("maps every supported interval to GeckoTerminal's timeframes and largest page", async () => {
    const { fetch, calls } = marketFetch({
      gecko: (u) =>
        u.pathname.includes("/ohlcv/")
          ? jsonResponse(geckoOhlcvResponse([]))
          : undefined,
    });
    for (const interval of ["5m", "15m", "1h", "4h", "1d"] as const)
      await fetchGeckoCandles(token, pinned, interval, { fetch });
    expect(
      calls.map(
        (c) =>
          new URL(c).pathname.split("/").pop() +
          new URL(c).search.split("&")[0],
      ),
    ).toEqual([
      "minute?aggregate=5",
      "minute?aggregate=15",
      "hour?aggregate=1",
      "hour?aggregate=4",
      "day?aggregate=1",
    ]);
    // The chart can zoom out over as much history as one request returns.
    expect(calls.map((c) => new URL(c).searchParams.get("limit"))).toEqual(
      Array(5).fill("1000"),
    );
  });

  it("orients trades to the tracked token and hides anomalous ones", async () => {
    const list = await fetchGeckoTrades(token, pinned, {
      fetch: marketFetch().fetch,
    });
    expect(list.trades).toHaveLength(2);
    expect(list.hiddenAnomalous).toBe(1);
    expect(list.trades[0]).toMatchObject({
      side: "buy",
      tokenAmount: "18985.365382667",
      priceUsd: "0.00182617527286454",
    });
    expect(list.trades[1]).toMatchObject({
      side: "sell",
      tokenAmount: "1074.74184614018",
    });
    expect(list.trades.every((t) => /^0x[0-9a-f]{64}$/.test(t.txHash))).toBe(
      true,
    );
  });
});

describe("DEX Screener adapter", () => {
  it("normalizes pairs and keeps only Base", async () => {
    const pools = await fetchDexscreenerPools(token, {
      fetch: marketFetch({
        dexscreener: () =>
          jsonResponse([
            {
              chainId: "ethereum",
              pairAddress: PRIMARY_POOL,
              baseToken: { address: WORTH },
              quoteToken: { address: WORTH },
            },
            ...dexscreenerPairsResponse,
          ]),
      }).fetch,
    });
    expect(pools).toHaveLength(3);
    expect(pools[0].pool).toMatchObject({
      protocol: "uniswap-v4",
      quoteToken: { kind: "native-eth" },
    });
    expect(pools[0].liquidityUsd).toBe("191337.86");
    expect(pools[0].provenance.source).toBe("dexscreener");
  });

  it("treats a missing liquidity field as unreported, not zero", async () => {
    const [pair] = dexscreenerPairsResponse;
    const withoutLiquidity: Record<string, unknown> = { ...pair };
    delete withoutLiquidity.liquidity;
    const pools = await fetchDexscreenerPools(token, {
      fetch: marketFetch({
        dexscreener: () => jsonResponse([withoutLiquidity]),
      }).fetch,
    });
    expect(pools[0].liquidityUsd).toBeNull();
    expect(selectPrimaryPool(token, pools).excluded[0].reason).toBe(
      "low-liquidity",
    );
  });
});

describe("primary pool selection", () => {
  it("never picks the look-alike pool, whatever its reserves", async () => {
    const pools = await fetchGeckoPools(token, { fetch: marketFetch().fetch });
    const selection = selectPrimaryPool(token, pools);
    expect(selection.reason).toBe("ranked");
    expect(selection.primary?.pool.id).toBe(PRIMARY_POOL);
    const reasons = Object.fromEntries(
      selection.excluded.map((e) => [e.pool.pool.id, e.reason]),
    );
    expect(reasons[IMPOSTOR_POOL]).toBe("token-not-base");
    expect(reasons[DUST_POOL]).toBe("low-liquidity");
    expect(selection.eligible.map((p) => p.pool.id)).toEqual([
      PRIMARY_POOL,
      USDC_POOL,
    ]);
  });

  it("keeps the pinned pool while eligible and reports when it is gone", async () => {
    const pools = await fetchGeckoPools(token, { fetch: marketFetch().fetch });
    expect(selectPrimaryPool(token, pools, USDC_POOL as Hex)).toMatchObject({
      reason: "pinned",
      primary: { pool: { id: USDC_POOL } },
    });
    const without = pools.filter((p) => p.pool.id !== PRIMARY_POOL);
    const moved = selectPrimaryPool(token, without, pinned);
    expect(moved.reason).toBe("pinned-missing");
    expect(moved.primary?.pool.id).toBe(USDC_POOL);
    expect(selectPrimaryPool(token, pools, DUST_POOL as Hex).reason).toBe(
      "pinned-ineligible",
    );
  });

  it("reports no eligible pool rather than inventing one", () => {
    expect(selectPrimaryPool(token, [])).toMatchObject({
      primary: null,
      reason: "none-eligible",
    });
  });

  it("refuses pools from another chain", async () => {
    const pools = await fetchGeckoPools(token, { fetch: marketFetch().fetch });
    const other = selectPrimaryPool({ chainId: 1, address: WORTH }, pools);
    expect(other.primary).toBeNull();
    expect(other.excluded.every((e) => e.reason === "other-chain")).toBe(true);
  });
});

describe("HTTP failures and fallback", () => {
  it.each([
    [429, "RATE_LIMITED"],
    [404, "NOT_FOUND"],
    [500, "HTTP_ERROR"],
    [503, "HTTP_ERROR"],
  ])("maps HTTP %i to %s", async (status, code) => {
    const error = await rejection(
      getProviderJson(
        "geckoterminal",
        "/api/v2/x",
        {},
        { fetch: async () => jsonResponse("nope", status) },
      ),
    );
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
  });

  it("reads Retry-After on 429", async () => {
    const error = await rejection(
      getProviderJson(
        "dexscreener",
        "/x",
        {},
        {
          fetch: async () => ({
            ...jsonResponse("", 429),
            headers: {
              get: (h: string) => (h === "retry-after" ? "12" : null),
            },
          }),
        },
      ),
    );
    expect(error.retryAfterMs).toBe(12_000);
    expect(error.retryable).toBe(false);
  });

  it("flags malformed JSON", async () => {
    const error = await rejection(
      getProviderJson(
        "geckoterminal",
        "/api/v2/x",
        {},
        { fetch: async () => jsonResponse("{not json") },
      ),
    );
    expect(error.code).toBe("INVALID_RESPONSE");
  });

  it("times out a provider that never answers", async () => {
    const error = await rejection(
      getProviderJson(
        "geckoterminal",
        "/api/v2/x",
        {},
        {
          timeoutMs: 20,
          fetch: (_url, init) =>
            new Promise((_, reject) =>
              init?.signal?.addEventListener("abort", () =>
                reject(new Error("aborted")),
              ),
            ),
        },
      ),
    );
    expect(error.code).toBe("TIMEOUT");
    expect(error.retryable).toBe(true);
  });

  it("maps a network failure and only fetches allowlisted hosts", async () => {
    const urls: string[] = [];
    const error = await rejection(
      getProviderJson(
        "dexscreener",
        "/tokens/v1/base/x",
        {},
        {
          fetch: async (url) => {
            urls.push(url);
            throw new TypeError("Failed to fetch");
          },
        },
      ),
    );
    expect(error.code).toBe("NETWORK");
    expect(urls).toEqual(["https://api.dexscreener.com/tokens/v1/base/x"]);
    expect(
      (await rejection(getProviderJson("dexscreener", "//evil.example/x", {})))
        .code,
    ).toBe("INVALID_INPUT");
  });

  it("falls back to DEX Screener when GeckoTerminal is rate limited", async () => {
    const { fetch } = marketFetch({
      gecko: () => jsonResponse("slow down", 429),
    });
    const market = await loadTokenMarket(token, {
      fetch,
      pinnedPoolId: pinned,
    });
    expect(market.source).toBe("dexscreener");
    expect(market.fallbackUsed).toBe(true);
    expect(market.failures).toEqual([
      expect.objectContaining({
        source: "geckoterminal",
        code: "RATE_LIMITED",
      }),
    ]);
    expect(market.selection).toMatchObject({
      reason: "pinned",
      primary: { pool: { id: PRIMARY_POOL } },
    });
  });

  it("surfaces an error when every provider fails, with no substitute data", async () => {
    const { fetch } = marketFetch({
      gecko: () => jsonResponse("down", 503),
      dexscreener: () => jsonResponse("down", 502),
    });
    const error = await rejection(loadTokenMarket(token, { fetch }));
    expect(error).toBeInstanceOf(MarketDataError);
    expect(error.code).toBe("HTTP_ERROR");
    expect(error.message).toMatch(/geckoterminal.*dexscreener/);
  });

  it("returns a no-market state when providers answer without an eligible pool", async () => {
    const { fetch } = marketFetch({
      gecko: (u) =>
        u.pathname.endsWith("/pools")
          ? jsonResponse({ data: [], included: [] })
          : undefined,
      dexscreener: () => jsonResponse([]),
    });
    const market = await loadTokenMarket(token, { fetch });
    expect(market.selection.primary).toBeNull();
    expect(market.failures.map((f) => f.code)).toEqual([
      "NO_ELIGIBLE_POOL",
      "NO_ELIGIBLE_POOL",
    ]);
  });

  it("refuses chains without market data", async () => {
    const error = await rejection(
      fetchGeckoPools(
        { chainId: 84532, address: WORTH },
        { fetch: marketFetch().fetch },
      ),
    );
    expect(error.code).toBe("UNSUPPORTED_CHAIN");
  });
});
