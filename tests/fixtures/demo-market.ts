import type { Address } from "viem";
/**
 * TEST FIXTURE ONLY. The fictional Stage 1 demo catalogue (15 invented
 * tokens, a deterministic price generator and invented trades). It used to
 * feed Discover and the token page; since Stage 4 production reads real Base
 * data and must never import this file (tests/no-mock-leakage.test.ts).
 * It is kept for controlled tests and future offline UI work.
 */
// Relative time uses the fixture clock, so results are deterministic.
export const DEMO_NOW = Date.parse("2026-10-26T15:00:00Z");
export function age(createdAt: string) {
  const m = Math.max(
    1,
    Math.floor((DEMO_NOW - Date.parse(createdAt)) / 60_000),
  );
  return m < 60
    ? `${m}m`
    : m < 1440
      ? `${Math.floor(m / 60)}h`
      : `${Math.floor(m / 1440)}d`;
}

export type LaunchStage = "new" | "graduating" | "graduated";
export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}
export interface TokenMarketData {
  priceUsd: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  liquidity: number;
  holders: number;
}
export interface BondingCurveState {
  progress: number;
  source: "demo" | "onchain";
}
export interface TokenLaunch {
  stage: LaunchStage;
  createdAt: string;
  creatorLabel: string;
  curve: BondingCurveState;
}
export interface Token {
  id: string;
  metadata: TokenMetadata;
  market: TokenMarketData;
  launch: TokenLaunch;
  contractAddress?: Address;
  demoReference: string;
  isDemo: boolean;
  accent: string;
}
export interface PricePoint {
  time: string;
  price: number;
  volume: number;
}
export interface Trade {
  id: string;
  side: "buy" | "sell";
  amount: number;
  priceUsd: number;
  walletLabel: string;
  minutesAgo: number;
  isDemo: boolean;
}
export interface UserPortfolio {
  address: Address;
  chainId: number;
  createdTokens: Token[];
  holdings: { tokenId: string; balance: string }[];
  activity: Trade[];
}
const rows: [
  string,
  string,
  string,
  string,
  LaunchStage,
  number,
  number,
  number,
  number,
  number,
  string,
][] = [
  [
    "orbit",
    "Orbit Cat",
    "ORBIT",
    "One small paw. One giant leap for catkind.",
    "new",
    2,
    12400,
    8200,
    24.8,
    18,
    "#a795e8",
  ],
  [
    "based",
    "Based & Confused",
    "BASED",
    "No roadmap. Just a very based state of mind.",
    "new",
    5,
    8700,
    4100,
    12.6,
    12,
    "#6f99ff",
  ],
  [
    "toast",
    "Toast Protocol",
    "TOAST",
    "A little burnt. Still built different.",
    "new",
    8,
    21300,
    15700,
    68.2,
    31,
    "#eab777",
  ],
  [
    "pebble",
    "Just a Pebble",
    "ROCK",
    "Probably nothing. Definitely a rock.",
    "new",
    14,
    5600,
    2300,
    -8.4,
    8,
    "#9eafa7",
  ],
  [
    "blob",
    "Blue Blob",
    "BLOB",
    "No thoughts, just a blob on Base.",
    "new",
    21,
    18200,
    11600,
    31.7,
    26,
    "#6594eb",
  ],
  [
    "moon",
    "Moon Again",
    "AGAIN",
    "Back for another trip around the moon.",
    "graduating",
    42,
    62400,
    94800,
    142.6,
    92,
    "#c6e99a",
  ],
  [
    "frog",
    "Frog Office",
    "FROG",
    "Clock in. Touch grass. Repeat.",
    "graduating",
    84,
    58200,
    72300,
    86.4,
    86,
    "#8dcbb5",
  ],
  [
    "capy",
    "Capy Collective",
    "CAPY",
    "Unbothered. Moisturized. Onchain.",
    "graduating",
    116,
    54600,
    48100,
    47.2,
    81,
    "#cdac8d",
  ],
  [
    "noodle",
    "Noodle Club",
    "NOOD",
    "The internet is held together by noodles.",
    "graduating",
    185,
    49800,
    39700,
    -5.3,
    74,
    "#ead693",
  ],
  [
    "pixel",
    "Pixel Punks",
    "PXLS",
    "Small pixels. Big internet energy.",
    "graduating",
    240,
    46400,
    31600,
    22.1,
    69,
    "#bf9ced",
  ],
  [
    "dog",
    "Second Chance",
    "CHANCE",
    "Every good dog deserves another round.",
    "graduated",
    1440,
    1240000,
    482000,
    184.2,
    100,
    "#d3af74",
  ],
  [
    "ufo",
    "Out of Office",
    "OOO",
    "Gone exploring. Please leave a message.",
    "graduated",
    2880,
    842000,
    316000,
    63.9,
    100,
    "#9cbcbc",
  ],
  [
    "ghost",
    "Ghost Mode",
    "GHOST",
    "Quietly haunting the Base ecosystem.",
    "graduated",
    4320,
    526000,
    192000,
    -12.8,
    100,
    "#cac9dc",
  ],
  [
    "mush",
    "Mushroom Internet",
    "SHROOM",
    "Connected by an underground network.",
    "graduated",
    5760,
    318000,
    124000,
    28.5,
    100,
    "#df9f9b",
  ],
  [
    "sun",
    "Good Morning",
    "GM",
    "A fresh start, every single block.",
    "graduated",
    7200,
    207000,
    86300,
    16.3,
    100,
    "#e4c77d",
  ],
];
export const tokens: Token[] = rows.map(
  (
    [
      id,
      name,
      symbol,
      description,
      stage,
      minutes,
      marketCap,
      volume24h,
      change24h,
      progress,
      accent,
    ],
    i,
  ) => ({
    id,
    metadata: { name, symbol, description, image: `/tokens/${id}.svg` },
    market: {
      priceUsd: marketCap / 1_000_000_000,
      marketCap,
      volume24h,
      change24h,
      liquidity: Math.round(marketCap * 0.19),
      holders: 32 + i * 127,
    },
    launch: {
      stage,
      createdAt: new Date(DEMO_NOW - minutes * 60_000).toISOString(),
      creatorLabel: `demo-creator-${String(i + 1).padStart(2, "0")}`,
      curve: { progress, source: "demo" },
    },
    demoReference: `DEMO-${symbol}-001`,
    isDemo: true,
    accent,
  }),
);
export type TokenSort = "recent" | "volume" | "marketCap";
export interface TokenQuery {
  search?: string;
  stage?: LaunchStage | "all";
  sort?: TokenSort;
}
export interface TokenDataProvider {
  list(query?: TokenQuery): Promise<Token[]>;
  get(id: string): Promise<Token | undefined>;
  history(id: string, interval: string): Promise<PricePoint[]>;
  trades(id: string): Promise<Trade[]>;
}
export function filterTokens(
  source: Token[],
  { search = "", stage = "all", sort = "recent" }: TokenQuery = {},
) {
  const term = search.trim().toLowerCase().replace(/^\$/, "");
  return source
    .filter(
      (t) =>
        (stage === "all" || t.launch.stage === stage) &&
        `${t.metadata.name} ${t.metadata.symbol}`.toLowerCase().includes(term),
    )
    .sort((a, b) =>
      sort === "recent"
        ? Date.parse(b.launch.createdAt) - Date.parse(a.launch.createdAt)
        : sort === "volume"
          ? b.market.volume24h - a.market.volume24h
          : b.market.marketCap - a.market.marketCap,
    );
}
export function generateHistory(token: Token, interval: string): PricePoint[] {
  const steps =
    interval === "1H"
      ? 1
      : interval === "4H"
        ? 4
        : interval === "1D"
          ? 24
          : 168;
  const seed = [...token.id].reduce((n, c) => n + c.charCodeAt(0), 0);
  return Array.from({ length: 64 }, (_, i) => ({
    time: new Date(
      Date.parse("2026-10-26T15:00:00Z") - (63 - i) * steps * 60_000,
    ).toISOString(),
    price:
      token.market.priceUsd *
      (0.48 +
        i / 120 +
        Math.sin(i * 0.61 + seed) * 0.055 +
        Math.cos(i * 1.7) * 0.028),
    volume: 200 + ((seed * (i + 3)) % 1600),
  }));
}
export const tokenProvider: TokenDataProvider = {
  async list(query) {
    return filterTokens(tokens, query);
  },
  async get(id) {
    return tokens.find((t) => t.id === id);
  },
  async history(id, interval) {
    const token = tokens.find((t) => t.id === id);
    return token ? generateHistory(token, interval) : [];
  },
  async trades(id) {
    const token = tokens.find((t) => t.id === id);
    return token
      ? Array.from({ length: 8 }, (_, i) => ({
          id: `${id}-${i}`,
          side: i % 3 === 0 ? "sell" : "buy",
          amount: 12500 + i * 8420,
          priceUsd: token.market.priceUsd * (1 - i / 150),
          walletLabel: `demo-wallet-${i + 1}`,
          minutesAgo: i + 1,
          isDemo: true,
        }))
      : [];
  },
};
