import type { Candle } from "./types";

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
export function priceStep(candles: readonly Candle[]) {
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
