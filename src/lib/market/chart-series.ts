import type { Candle, CandleInterval } from "./types";

export const INTERVAL_SECONDS: Record<CandleInterval, number> = {
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14_400,
  "1d": 86_400,
};

/** At most this many time slots are drawn (about 69 days of 5m buckets). */
export const MAX_CHART_SLOTS = 20_000;

/** One bucket on the time axis; `candle` is null when nothing traded. */
export interface ChartSlot {
  time: number;
  candle: Candle | null;
}

export interface ChartSeries {
  slots: ChartSlot[];
  /** Empty buckets between the first and last candle drawn. */
  gaps: number;
  /** Oldest candles left out because they lie beyond `MAX_CHART_SLOTS`. */
  trimmed: number;
}

/**
 * Missing buckets become empty slots so the time axis keeps its spacing and
 * the gap stays visible. Nothing is interpolated: an empty slot draws nothing.
 * A series too sparse to pad within `maxSlots` keeps its newest candles.
 * `candles` must be sorted and aligned to the interval (`normalizeCandles`).
 */
export function chartSeries(
  candles: readonly Candle[],
  intervalSeconds: number,
  maxSlots = MAX_CHART_SLOTS,
): ChartSeries {
  if (!candles.length) return { slots: [], gaps: 0, trimmed: 0 };
  const oldest = candles.at(-1)!.time - (maxSlots - 1) * intervalSeconds;
  const kept = candles.filter((candle) => candle.time >= oldest);
  const slots: ChartSlot[] = [];
  for (const candle of kept) {
    const previous = slots.at(-1);
    if (previous)
      for (
        let time = previous.time + intervalSeconds;
        time < candle.time;
        time += intervalSeconds
      )
        slots.push({ time, candle: null });
    slots.push({ time: candle.time, candle });
  }
  return {
    slots,
    gaps: slots.length - kept.length,
    trimmed: candles.length - kept.length,
  };
}

/**
 * How many of the newest slots the chart opens on: about 7 px per bar, so a
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
