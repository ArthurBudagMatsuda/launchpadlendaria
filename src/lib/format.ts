export const usd = (value: number, compact = true) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
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
// Relative time uses the fixture clock, so SSR and hydration always agree.
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
