import type { RetryPool } from "./pools";

/**
 * RETRY's naming rules: at most two launches per name and two per ticker,
 * and a creator cannot launch the same name and ticker twice. They are
 * platform rules, not on-chain guarantees: SPL token names and tickers are
 * not unique on Solana, and anyone can call the DBC program with RETRY's
 * config directly. The launch screen enforces them, and Discover marks a
 * launch that breaks them, so one made around the screen still shows for
 * what it is. A token is always identified by its mint address.
 */
export const MAX_LAUNCHES_PER_NAME = 2;
export const MAX_LAUNCHES_PER_TICKER = 2;

/** Names match case-insensitively with spacing collapsed. */
export const nameKey = (name: string) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
export const tickerKey = (symbol: string) =>
  symbol.normalize("NFKC").trim().toUpperCase();

interface NamedLaunch {
  pool: Pick<RetryPool, "address" | "creator" | "activationPoint">;
  metadata: { name: string; symbol: string } | null;
}

export type NamingBlock = "creator-repeat" | "name-limit" | "ticker-limit";

/** Whether a new launch may use this name and ticker on this cluster. */
export function namingCheck(
  draft: { name: string; symbol: string },
  creator: string,
  launches: readonly NamedLaunch[],
) {
  const name = nameKey(draft.name);
  const ticker = tickerKey(draft.symbol);
  const named = launches.filter(
    (launch) => launch.metadata && nameKey(launch.metadata.name) === name,
  );
  const tickered = launches.filter(
    (launch) => launch.metadata && tickerKey(launch.metadata.symbol) === ticker,
  );
  const block: NamingBlock | null = named.some(
    (launch) =>
      launch.pool.creator === creator &&
      tickerKey(launch.metadata!.symbol) === ticker,
  )
    ? "creator-repeat"
    : named.length >= MAX_LAUNCHES_PER_NAME
      ? "name-limit"
      : tickered.length >= MAX_LAUNCHES_PER_TICKER
        ? "ticker-limit"
        : null;
  return { sameName: named.length, sameTicker: tickered.length, block };
}

export interface NamingFlag {
  /** Launched after the limit was reached (or repeats its creator's pair). */
  overLimit: boolean;
  /** RETRY launches on this cluster with the same ticker, this one included. */
  sameTicker: number;
}

/**
 * The same rules applied to what is already on-chain, oldest launch first:
 * the first two launches of a name or ticker are within the rules, later
 * ones are not. Launches whose metadata could not be read are skipped.
 */
export function namingFlags(
  launches: readonly NamedLaunch[],
): Map<string, NamingFlag> {
  const ordered = launches
    .filter((launch) => launch.metadata)
    .sort(
      (a, b) =>
        Number(a.pool.activationPoint - b.pool.activationPoint) ||
        a.pool.address.localeCompare(b.pool.address),
    );
  const names = new Map<string, number>();
  const tickers = new Map<string, number>();
  const pairs = new Set<string>();
  const flags = new Map<string, NamingFlag>();
  for (const { pool, metadata } of ordered) {
    const name = nameKey(metadata!.name);
    const ticker = tickerKey(metadata!.symbol);
    const pair = JSON.stringify([pool.creator, name, ticker]);
    const overLimit =
      pairs.has(pair) ||
      (names.get(name) ?? 0) >= MAX_LAUNCHES_PER_NAME ||
      (tickers.get(ticker) ?? 0) >= MAX_LAUNCHES_PER_TICKER;
    names.set(name, (names.get(name) ?? 0) + 1);
    tickers.set(ticker, (tickers.get(ticker) ?? 0) + 1);
    pairs.add(pair);
    flags.set(pool.address, { overLimit, sameTicker: 0 });
  }
  for (const { pool, metadata } of ordered)
    flags.get(pool.address)!.sameTicker = tickers.get(
      tickerKey(metadata!.symbol),
    )!;
  return flags;
}
