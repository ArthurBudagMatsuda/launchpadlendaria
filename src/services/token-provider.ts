import type { LaunchStage, PricePoint, Token, Trade } from "@/types/token";
import { tokens } from "@/data/tokens";
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
