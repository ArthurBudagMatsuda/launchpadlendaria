export const usd = (value: number, compact = true) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    // Compact currency defaults differ between ICU versions ($12.40K in
    // Node 22, $12.4K in Node 24 and browsers), which breaks hydration.
    ...(compact && { minimumFractionDigits: 0 }),
    maximumFractionDigits: value < 1 ? 7 : 2,
  }).format(value);
export const number = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
export const percent = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
export const shorten = (value: string) =>
  `${value.slice(0, 6)}…${value.slice(-4)}`;

// Market values arrive as exact decimal strings. Intl formats a numeric
// string without converting it to a float first, so the printed digits are
// the provider's (or the exact FDV's), not a binary approximation.
type NumericString = `${number}`;
const numeric = (value: string) => value as NumericString;

/** Compact USD for liquidity, volume and FDV: "$191.3K", "$1.83M". */
export const usdAmount = (value: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric(value));

/** Below this, prices switch to scientific notation (dust pools). */
const TINY = 1e-12;
const significant = (value: string, options: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat("en-US", {
    ...options,
    ...(Number(value) !== 0 && Math.abs(Number(value)) < TINY
      ? { notation: "scientific", maximumSignificantDigits: 4 }
      : Math.abs(Number(value)) >= 1
        ? { minimumFractionDigits: 2, maximumFractionDigits: 4 }
        : { maximumSignificantDigits: 4 }),
  }).format(numeric(value));

/** Token prices keep four significant digits, however small: "$0.001826". */
export const usdPrice = (value: string) =>
  significant(value, { style: "currency", currency: "USD" });

/** Quote-asset prices (ETH per token, etc.): "0.000000775 ETH". */
export const quotePrice = (value: string, symbol: string) =>
  `${significant(value)} ${symbol}`;

/** Token amounts: compact above 10K, otherwise up to 4 decimals. */
export const tokenAmount = (value: string) =>
  new Intl.NumberFormat("en-US", {
    notation: Number(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: Number(value) >= 10_000 ? 2 : 4,
  }).format(numeric(value));

/** Whole-number token supply with grouping: "1,000,000,000". */
export const tokenSupply = (value: string) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(
    numeric(value),
  );

export const signedPercent = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

/** Wall-clock time in UTC, e.g. "03:01:09 UTC". */
export const utcTime = (ms: number) =>
  `${new Date(ms).toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" })} UTC`;

/** "45s ago", "12m ago", "3h ago", "2d ago". */
export function ago(ms: number, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
