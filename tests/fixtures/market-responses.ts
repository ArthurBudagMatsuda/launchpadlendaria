import {
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  multicall3Abi,
  type Address,
  type Hex,
} from "viem";
import { b20FactoryAbi, B20_FACTORY } from "../../src/lib/market/onchain";

/**
 * TEST FIXTURES ONLY. Provider responses shaped like the real GeckoTerminal
 * and DEX Screener answers recorded by .github/workflows/market-data-verify.yml
 * (runs 40623949754 and 40624224187, 2026-10-28), trimmed to a few pools.
 * Pool, pair and on-chain figures are copied from those responses. The
 * candle and trade lists are shortened and partly synthetic (e.g. the gap and
 * the anomalous trade) to exercise edge cases. Production code must never
 * import this file.
 */
export const WORTH: Address = "0xB200000000000000000000585fd80C20af698f01";
export const WORTH_LOWER = WORTH.toLowerCase();
export const IMPOSTOR: Address = "0x5e5Ff0170d13049e0e048F8eabc98f8FBd4eEFD1";
export const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const NATIVE_ETH: Address = "0x0000000000000000000000000000000000000000";
export const CBETH: Address = "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22";
export const PRIMARY_POOL =
  "0x6cf637a82362d304dfa56a6387fc8f909ec0008ec520ee5fb999506d9b1f3514";
export const USDC_POOL =
  "0x23b6181dc3c64fa615aab3b33ef661ff8ae4ceb65679c88497bc3cb8a87a86c9";
export const IMPOSTOR_POOL =
  "0xcf1abd9290345679c11ed86b81ea034e4c9e6f56bc3c1ada2df2a0b8e6b6dd9f";
export const DUST_POOL =
  "0xf5361bcfbe551836453ae966427e51e861e35d6ca47b3223184de06c056f983e";
export const AERO_POOL = "0x445fb8bbd7adc4e14089efe0031df1672cc5ba73";

const tx = (buys: number, sells: number) => ({
  buys,
  sells,
  buyers: buys,
  sellers: sells,
});

function geckoPool(o: {
  address: string;
  name: string;
  dex: string;
  base: string;
  quote: string;
  priceUsd: string;
  priceQuote: string;
  reserve: string;
  volume24: string;
  change24: string;
  txns24: [number, number];
  created: string;
}) {
  return {
    id: `base_${o.address}`,
    type: "pool",
    attributes: {
      address: o.address,
      name: o.name,
      pool_created_at: o.created,
      base_token_price_usd: o.priceUsd,
      base_token_price_quote_token: o.priceQuote,
      reserve_in_usd: o.reserve,
      volume_usd: {
        m5: "1.96",
        m15: "340.84",
        m30: "4820.31",
        h1: "12042.73",
        h6: "143202.27",
        h24: o.volume24,
      },
      price_change_percentage: {
        m5: "0",
        m15: "-0.332",
        m30: "-4.211",
        h1: "-9.2",
        h6: "-3.91",
        h24: o.change24,
      },
      transactions: {
        m5: tx(1, 0),
        h1: tx(29, 53),
        h6: tx(364, 503),
        h24: tx(...o.txns24),
      },
      fdv_usd: "1826368.907",
      market_cap_usd: "1826368.907",
    },
    relationships: {
      base_token: {
        data: { id: `base_${o.base.toLowerCase()}`, type: "token" },
      },
      quote_token: {
        data: { id: `base_${o.quote.toLowerCase()}`, type: "token" },
      },
      dex: { data: { id: o.dex, type: "dex" } },
    },
  };
}

const included = [
  [WORTH, "one life, its worth an attempt", "worth"],
  [NATIVE_ETH, "Ether", "ETH"],
  [USDC, "USD Coin", "USDC"],
  [IMPOSTOR, "worth", "worth"],
  [CBETH, "Coinbase Wrapped Staked ETH", "cbETH"],
].map(([address, name, symbol]) => ({
  id: `base_${address.toLowerCase()}`,
  type: "token",
  attributes: { address: address.toLowerCase(), name, symbol, decimals: 18 },
}));

export const geckoPoolsResponse = {
  data: [
    geckoPool({
      address: PRIMARY_POOL,
      name: "worth / ETH",
      dex: "o1-launchpad",
      base: WORTH,
      quote: NATIVE_ETH,
      priceUsd: "0.001826368907",
      priceQuote: "0.0000007750477017",
      reserve: "190930.2863",
      volume24: "882053.012442756",
      change24: "108.2",
      txns24: [2217, 2050],
      created: "2026-08-15T19:11:51Z",
    }),
    geckoPool({
      address: USDC_POOL,
      name: "worth / USDC 5%",
      dex: "uniswap-v4-base",
      base: WORTH,
      quote: USDC,
      priceUsd: "0.001899041736",
      priceQuote: "0.001899041736",
      reserve: "59126.6888",
      volume24: "54384.0379211835",
      change24: "106.47",
      txns24: [271, 246],
      created: "2026-10-23T18:40:47Z",
    }),
    // A look-alike "worth" token as base, with inflated reserves.
    geckoPool({
      address: IMPOSTOR_POOL,
      name: "worth / worth 0.25%",
      dex: "uniswap-v4-base",
      base: IMPOSTOR,
      quote: WORTH,
      priceUsd: "0.002136557024",
      priceQuote: "1.000003639",
      reserve: "267660.964",
      volume24: "1.8776319828",
      change24: "2.27",
      txns24: [1, 4],
      created: "2026-10-27T18:17:37Z",
    }),
    geckoPool({
      address: DUST_POOL,
      name: "worth / USDC 90%",
      dex: "uniswap-v4-base",
      base: WORTH,
      quote: USDC,
      priceUsd: "0.0002413565956",
      priceQuote: "0.0002413565956",
      reserve: "45.6806",
      volume24: "6.4725560117",
      change24: "53.71",
      txns24: [15, 0],
      created: "2026-08-17T00:50:21Z",
    }),
    geckoPool({
      address: AERO_POOL,
      name: "cbETH / worth",
      dex: "aero-slipstream-base",
      base: CBETH,
      quote: WORTH,
      priceUsd: "2674.8832990717",
      priceQuote: "1355000",
      reserve: "1.1771",
      volume24: "0.7214971638",
      change24: "-0.78",
      txns24: [0, 2],
      created: "2026-10-27T20:41:59Z",
    }),
  ],
  included,
};

/** Rows newest first, like GeckoTerminal; 1h buckets with one missing hour. */
export const geckoOhlcvResponse = (rows?: unknown[]) => ({
  data: {
    id: "ohlcv",
    type: "ohlcv_request_response",
    attributes: {
      ohlcv_list: rows ?? [
        [
          1793156400, 0.00183150839428153, 0.00183573783766731,
          0.00182636890717942, 0.00182636890717942, 1240.5,
        ],
        [
          1793152800, 0.00190632137825483, 0.00192358138985074,
          0.00183150839428153, 0.00183150839428153, 4479.47,
        ],
        // 1793149200 missing: no trades in that hour.
        [
          1793145600, 0.00190318147761655, 0.00206420239905208,
          0.00174107467889263, 0.00190632137825483, 65263.91,
        ],
      ],
    },
  },
  meta: {
    base: {
      name: "one life, its worth an attempt",
      symbol: "worth",
      address: WORTH_LOWER,
    },
    quote: { name: "Ether", symbol: "ETH", address: NATIVE_ETH },
  },
});

/**
 * Daily buckets (UTC midnight), newest first. Oct 27 holds the pool's high,
 * $0.00243673440800152, as recorded by the verify workflow on 2026-10-28;
 * the other values are synthetic.
 */
export const geckoDailyOhlcvResponse = () =>
  geckoOhlcvResponse([
    [
      1793145600, 0.0019, 0.00206420239905208, 0.00174107467889263,
      0.00182636890717942, 71089.79,
    ],
    [1793059200, 0.0006, 0.00243673440800152, 0.00059, 0.0019, 901233.12],
    [1792972800, 0.00042, 0.00061, 0.0004, 0.0006, 120345.5],
  ]);

function geckoTrade(o: {
  block: number;
  time: string;
  hash: string;
  kind: "buy" | "sell";
  amountEth: string;
  amountWorth: string;
  priceUsd: string;
  volume: string;
  anomalous?: boolean;
}) {
  const buy = o.kind === "buy";
  return {
    id: `base_${o.block}_${o.hash}_1_${Date.parse(o.time) / 1000}`,
    type: "trade",
    attributes: {
      block_number: o.block,
      block_timestamp: o.time,
      tx_hash: o.hash,
      tx_from_address: "0x34fa24b19b4a982d6d725c438138272776c05e47",
      kind: o.kind,
      from_token_address: buy ? NATIVE_ETH : WORTH_LOWER,
      to_token_address: buy ? WORTH_LOWER : NATIVE_ETH,
      from_token_amount: buy ? o.amountEth : o.amountWorth,
      to_token_amount: buy ? o.amountWorth : o.amountEth,
      price_from_in_usd: buy ? "2355.33" : o.priceUsd,
      price_to_in_usd: buy ? o.priceUsd : "2355.33",
      volume_in_usd: o.volume,
      is_anomalous: o.anomalous ?? false,
    },
  };
}

export const geckoTradesResponse = {
  data: [
    geckoTrade({
      block: 53183536,
      time: "2026-10-28T03:00:19Z",
      hash: "0xd063902d8f7b0a1a6ac385736f4fd4dc1bdf3e4b67aced249200a7c93451c8c6",
      kind: "buy",
      amountEth: "0.0147200625",
      amountWorth: "18985.365382667",
      priceUsd: "0.00182617527286454",
      volume: "34.670604808125",
    }),
    geckoTrade({
      block: 53183400,
      time: "2026-10-28T02:55:47Z",
      hash: "0x4834fa281e537018e216d4e69a8bac5a4fbd96ef94ffc5f877deeabb37a3f54c",
      kind: "sell",
      amountEth: "0.000832976197786099",
      amountWorth: "1074.74184614018",
      priceUsd: "0.00182636890717942",
      volume: "1.96287509103503",
    }),
    geckoTrade({
      block: 53183390,
      time: "2026-10-28T02:55:27Z",
      hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      kind: "buy",
      amountEth: "40",
      amountWorth: "1",
      priceUsd: "94213.2",
      volume: "94213.2",
      anomalous: true,
    }),
  ],
};

function dexPair(o: {
  pairAddress: string;
  base: [string, string, string];
  quote: [string, string, string];
  priceUsd: string;
  priceNative: string;
  liquidity?: number;
  volume24: number;
  change24: number;
  txns24: [number, number];
}) {
  return {
    chainId: "base",
    dexId: "uniswap",
    url: `https://dexscreener.com/base/${o.pairAddress.toLowerCase()}`,
    pairAddress: o.pairAddress,
    labels: ["v4"],
    baseToken: { address: o.base[0], name: o.base[1], symbol: o.base[2] },
    quoteToken: { address: o.quote[0], name: o.quote[1], symbol: o.quote[2] },
    priceNative: o.priceNative,
    priceUsd: o.priceUsd,
    txns: {
      m5: { buys: 1, sells: 2 },
      h1: { buys: 30, sells: 57 },
      h6: { buys: 392, sells: 524 },
      h24: { buys: o.txns24[0], sells: o.txns24[1] },
    },
    volume: { h24: o.volume24, h6: 145858.68, h1: 12448.21, m5: 212.47 },
    priceChange: { m5: -0.22, h1: -9.07, h6: -3.76, h24: o.change24 },
    ...(o.liquidity !== undefined && {
      liquidity: { usd: o.liquidity, base: 53585280, quote: 39.475 },
    }),
    fdv: 1830657,
    marketCap: 1830657,
    pairCreatedAt: 1786821111000,
  };
}

const WORTH_TOKEN: [string, string, string] = [
  WORTH,
  "one life, its worth an attempt",
  "worth",
];
export const dexscreenerPairsResponse = [
  dexPair({
    pairAddress: PRIMARY_POOL,
    base: WORTH_TOKEN,
    quote: [NATIVE_ETH, "Ether", "ETH"],
    priceUsd: "0.001830",
    priceNative: "0.0000007750",
    liquidity: 191337.86,
    volume24: 909686.32,
    change24: 104,
    txns24: [2385, 2270],
  }),
  dexPair({
    pairAddress: USDC_POOL,
    base: WORTH_TOKEN,
    quote: [USDC, "USD Coin", "USDC"],
    priceUsd: "0.001908",
    priceNative: "0.001908",
    liquidity: 59404.52,
    volume24: 55974.54,
    change24: 106,
    txns24: [277, 245],
  }),
  dexPair({
    pairAddress: IMPOSTOR_POOL,
    base: [IMPOSTOR, "worth", "worth"],
    quote: WORTH_TOKEN,
    priceUsd: "0.002048",
    priceNative: "1.000003639",
    liquidity: 256025.23,
    volume24: 3.28,
    change24: 2.27,
    txns24: [5, 3],
  }),
];

type FetchResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};
export function jsonResponse(body: unknown, status = 200): FetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

/** Answers the provider URLs the app requests, like the live APIs do. */
export function marketFetch(
  overrides: {
    gecko?: (url: URL) => FetchResponse | undefined;
    dexscreener?: (url: URL) => FetchResponse | undefined;
  } = {},
) {
  const calls: string[] = [];
  const fetch = async (input: string) => {
    calls.push(input);
    const url = new URL(input);
    if (url.hostname === "api.geckoterminal.com") {
      const custom = overrides.gecko?.(url);
      if (custom) return custom;
      if (url.pathname.endsWith("/pools") && url.pathname.includes("/tokens/"))
        return jsonResponse(geckoPoolsResponse);
      if (url.pathname.includes("/ohlcv/day"))
        return jsonResponse(geckoDailyOhlcvResponse());
      if (url.pathname.includes("/ohlcv/"))
        return jsonResponse(geckoOhlcvResponse());
      if (url.pathname.endsWith("/trades"))
        return jsonResponse(geckoTradesResponse);
    }
    if (url.hostname === "api.dexscreener.com") {
      const custom = overrides.dexscreener?.(url);
      if (custom) return custom;
      if (url.pathname.startsWith("/tokens/v1/base/"))
        return jsonResponse(dexscreenerPairsResponse);
    }
    return jsonResponse({ error: "not found" }, 404);
  };
  return { fetch, calls };
}

/**
 * Base RPC answers for the token-identity reads: eth_getCode returns the B20
 * precompile marker and Multicall3 answers ERC-20 metadata plus the B20
 * factory's isB20Initialized, as Base mainnet did on 2026-10-28.
 */
export const WORTH_ONCHAIN = {
  name: "one life, its worth an attempt",
  symbol: "worth",
  decimals: 18,
  totalSupply: 10n ** 27n,
};
export function answerTokenCall(
  target: Address,
  data: Hex,
  balanceOf: (owner: Address) => bigint = () => 0n,
): { success: boolean; returnData: Hex } {
  const fail = { success: false, returnData: "0x" as Hex };
  if (target.toLowerCase() === B20_FACTORY.toLowerCase()) {
    const call = decodeFunctionData({ abi: b20FactoryAbi, data });
    const [token] = call.args as readonly [Address];
    return {
      success: true,
      returnData: encodeFunctionResult({
        abi: b20FactoryAbi,
        functionName: call.functionName,
        result: token.toLowerCase() === WORTH_LOWER,
      }),
    };
  }
  if (target.toLowerCase() !== WORTH_LOWER) return fail;
  const call = decodeFunctionData({ abi: erc20Abi, data });
  const result =
    call.functionName === "balanceOf"
      ? balanceOf((call.args as readonly [Address])[0])
      : WORTH_ONCHAIN[call.functionName as keyof typeof WORTH_ONCHAIN];
  if (result === undefined) return fail;
  return {
    success: true,
    returnData: encodeFunctionResult({
      abi: erc20Abi,
      functionName: call.functionName,
      result: result as never,
    }),
  };
}

/** Decodes an aggregate3 call and answers each inner token/B20 read. */
export function answerTokenMulticall(data: Hex): Hex | undefined {
  const decoded = decodeFunctionData({ abi: multicall3Abi, data });
  if (decoded.functionName !== "aggregate3") return undefined;
  const [calls] = decoded.args as readonly [
    readonly { target: Address; callData: Hex }[],
  ];
  return encodeFunctionResult({
    abi: multicall3Abi,
    functionName: "aggregate3",
    result: calls.map(({ target, callData }) => {
      try {
        return answerTokenCall(target, callData);
      } catch {
        return { success: false, returnData: "0x" as Hex };
      }
    }),
  });
}
