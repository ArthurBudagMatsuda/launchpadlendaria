import type { Candle, CandleInterval } from "./types";

export const INTERVAL_SECONDS: Record<CandleInterval, number> = {
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14_400,
  "1d": 86_400,
};

/** Intervals without trades between the first and the last candle. */
export function countGaps(candles: readonly Candle[], intervalSeconds: number) {
  let gaps = 0;
  for (let i = 1; i < candles.length; i += 1)
    gaps += (candles[i].time - candles[i - 1].time) / intervalSeconds - 1;
  return gaps;
}

/**
 * Pages of one series as a single run of candles, oldest first. A candle in
 * several pages keeps the copy from the latest argument, so pass the oldest
 * page first and the newest page last.
 */
export function mergeCandles(...pages: readonly (readonly Candle[])[]) {
  const byTime = new Map<number, Candle>();
  for (const page of pages)
    for (const candle of page) byTime.set(candle.time, candle);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/**
 * How many of the newest candles the chart opens on: about 7 px per bar, so a
 * phone shows a day or two of hourly candles and a desktop about a week.
 * Older history stays one drag or zoom away.
 */
export function initialBars(width: number, total: number) {
  return Math.min(total, Math.max(24, Math.min(180, Math.round(width / 7))));
}

/**
 * Smallest price step on the axis: four significant digits of the lowest
 * price in the series, so a $0.00001 low and a $0.0024 high both keep their
 * digits when zoomed in.
 */
export function priceStep(candles: readonly Pick<Candle, "low">[]) {
  const lows = candles.map((candle) => candle.low).filter((low) => low > 0);
  if (!lows.length) return 0.01;
  const step = 10 ** (Math.floor(Math.log10(Math.min(...lows))) - 3);
  return Math.min(0.01, Math.max(1e-15, step));
}

/** The highest price a pool traded at, and the candle that reached it. */
export interface PriceHigh {
  price: number;
  /** Start of the candle that reached it (UTC seconds). */
  time: number;
  /** Start of the oldest candle searched (UTC seconds). */
  since: number;
}

/**
 * Highest high across candle series of one pool: its daily history plus,
 * optionally, the intraday candles on screen, which can be newer than the
 * last daily refresh. `since` says how far back the search reached.
 */
export function highestHigh(
  ...series: readonly (readonly Candle[])[]
): PriceHigh | null {
  const candles = series.flat();
  if (!candles.length) return null;
  const top = candles.reduce((best, candle) =>
    candle.high > best.high ? candle : best,
  );
  return {
    price: top.high,
    time: top.time,
    since: Math.min(...candles.map((candle) => candle.time)),
  };
}
