import { describe, expect, it, vi, afterEach } from "vitest";
import { parseAddress } from "@/lib/solana/address";
import {
  loadSolanaMarket,
  loadSolanaCandles,
  loadSolanaTrades,
  normalizeCandles,
  normalizeSolanaPair,
  selectSolanaPool,
} from "@/lib/market/solana-market";
const mint = parseAddress("11111111111111111111111111111111")!;
const pool = parseAddress("SysvarRent111111111111111111111111111111111")!;
const token = { cluster: "mainnet-beta" as const, address: mint };
const pair = {
  chainId: "solana",
  pairAddress: pool,
  dexId: "raydium",
  baseToken: { address: mint, symbol: "TEST" },
  quoteToken: {
    address: "So11111111111111111111111111111111111111112",
    symbol: "WSOL",
  },
  priceUsd: "0.1",
  priceNative: "0.0001",
  liquidity: { usd: 2000 },
  volume: { h24: 100 },
  priceChange: { h24: 2 },
  txns: { h24: { buys: 2, sells: 1 } },
};
afterEach(() => vi.unstubAllGlobals());
describe("Solana market identity and history", () => {
  it("requests the largest page and validates an older-page cursor before HTTP", async () => {
    const fetch = vi.fn(
      async (_url: string) =>
        new Response(
          JSON.stringify({
            meta: { base: { address: mint } },
            data: { attributes: { ohlcv_list: [] } },
          }),
        ),
    );
    await loadSolanaCandles(token, pool, "1h", { fetch }, 1793145600);
    const url = new URL(fetch.mock.calls[0][0] as unknown as string);
    expect(url.searchParams.get("limit")).toBe("1000");
    expect(url.searchParams.get("before_timestamp")).toBe("1793145600");
    for (const cursor of [0, -1, 1.5, NaN])
      await expect(
        loadSolanaCandles(token, pool, "1h", { fetch }, cursor),
      ).rejects.toThrow(/cursor/);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("uses the Solana fallback when the primary provider is rate limited", async () => {
    const fetch = vi.fn(
      async (url: string) =>
        new Response(
          url.includes("geckoterminal") ? "{}" : JSON.stringify([pair]),
          {
            status: url.includes("geckoterminal") ? 429 : 200,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    const market = await loadSolanaMarket(token, { fetch });
    expect(market.source).toBe("dexscreener");
    expect(market.fallbackUsed).toBe(true);
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?page=1`,
      `https://api.dexscreener.com/tokens/v1/solana/${mint}`,
    ]);
  });
  it("distinguishes an empty market from an outage", async () => {
    const empty = await loadSolanaMarket(token, {
      fetch: async (url) =>
        new Response(url.includes("geckoterminal") ? '{"data":[]}' : "[]"),
    });
    expect(empty.selection.primary).toBeNull();
    await expect(
      loadSolanaMarket(token, {
        fetch: async () => new Response("{}", { status: 503 }),
      }),
    ).rejects.toThrow(/unavailable/);
  });
  it("rejects malformed numeric records without throwing in pool selection", () => {
    const record = normalizeSolanaPair(token, pair, "dexscreener")!;
    expect(
      selectSolanaPool(token, [{ ...record, priceUsd: "bad" }]).primary,
    ).toBeNull();
    expect(
      selectSolanaPool(token, [{ ...record, liquidityUsd: "bad" }]).primary,
    ).toBeNull();
  });
  it("rejects candles for another mint instead of inverting or relabeling them", async () => {
    await expect(
      loadSolanaCandles(token, pool, "1h", {
        fetch: async () =>
          new Response(
            JSON.stringify({
              meta: { base: { address: pool } },
              data: { attributes: { ohlcv_list: [] } },
            }),
          ),
      }),
    ).rejects.toThrow(/mint/);
  });
  it("indexes only matching token trades with Solana signatures", async () => {
    const time = new Date(Date.now() - 60000).toISOString();
    const item = {
      id: "swap-1",
      attributes: {
        kind: "buy",
        tx_hash: "3".repeat(87),
        to_token_address: mint,
        from_token_address: pool,
        to_token_amount: "0.000000001",
        block_timestamp: time,
        block_number: 123,
      },
    };
    const result = await loadSolanaTrades(token, pool, {
      fetch: async () =>
        new Response(
          JSON.stringify({
            data: [
              item,
              item,
              {
                ...item,
                attributes: { ...item.attributes, tx_hash: "0xdeadbeef" },
              },
              {
                ...item,
                attributes: { ...item.attributes, to_token_address: pool },
              },
            ],
          }),
        ),
    });
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].tokenAmount).toBe("0.000000001");
    expect(result.trades[0].slot).toBe(123);
  });
  it("accepts matching Solana pool identity and keeps exact decimal strings", () => {
    const normalized = normalizeSolanaPair(token, pair, "dexscreener")!;
    expect(normalized.priceUsd).toBe("0.1");
    expect(normalized.pool.baseToken.address).toBe(mint);
    expect(normalized.pool.protocol).toBe("raydium");
    expect(selectSolanaPool(token, [normalized]).primary?.pool.id).toBe(pool);
  });
  it("rejects EVM chains and mixed mint identities", () => {
    expect(
      normalizeSolanaPair(token, { ...pair, chainId: "base" }, "dexscreener"),
    ).toBeNull();
    expect(
      normalizeSolanaPair(
        token,
        { ...pair, baseToken: { address: pool } },
        "dexscreener",
      ),
    ).toBeNull();
    expect(
      normalizeSolanaPair(
        token,
        { ...pair, pairAddress: "0x1234" },
        "dexscreener",
      ),
    ).toBeNull();
  });
  it("does not call Mainnet APIs from Devnet", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      loadSolanaMarket({ ...token, cluster: "devnet" }),
    ).rejects.toThrow(/Mainnet/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not sum liquidity or select an inactive low-liquidity pool", () => {
    const record = normalizeSolanaPair(token, pair, "dexscreener")!;
    expect(
      selectSolanaPool(token, [{ ...record, liquidityUsd: "10" }]).primary,
    ).toBeNull();
    expect(
      selectSolanaPool(token, [
        { ...record, txns: { h1: null, h24: { buys: 0, sells: 0 } } },
      ]).primary,
    ).toBeNull();
  });
  it("validates OHLCV and preserves missing buckets without interpolation", () => {
    const time = Date.UTC(2026, 9, 28) / 1000;
    const result = normalizeCandles(
      [
        [time, 1, 3, 1, 2, 10],
        [time, 1, 3, 1, 2, 10],
        [time + 600, 2, 4, 1, 3, 20],
        [time + 300, 1, 0, 2, 1, 10],
      ],
      300,
    );
    expect(result.candles).toHaveLength(2);
    expect(result.dropped).toBe(2);
    expect(result.gaps).toBe(1);
  });
});
