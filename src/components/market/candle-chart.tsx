"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { RotateCcw } from "lucide-react";
import {
  initialBars,
  priceStep,
  type ChartSeries,
  type ChartSlot,
} from "@/lib/market/chart-series";
import type { CandleInterval } from "@/lib/market/types";
import { usdAmount, usdPrice } from "@/lib/format";

const UP = "#5bd5a3";
const DOWN = "#f07787";
const UP_VOLUME = "rgba(91, 213, 163, 0.32)";
const DOWN_VOLUME = "rgba(240, 119, 135, 0.32)";
/** Empty bars kept right of the newest candle. */
const RIGHT_OFFSET = 4;

interface ChartApi {
  chart: IChartApi;
  candles: ISeriesApi<"Candlestick">;
  line: ISeriesApi<"Line">;
  volume: ISeriesApi<"Histogram">;
}

/** "Oct 28, 13:00 UTC", or "Oct 28, 2026" for daily candles. */
function slotTime(seconds: number, interval: CandleInterval) {
  const date = new Date(seconds * 1000);
  return interval === "1d"
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : `${date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: "UTC",
      })} UTC`;
}

/** Axis labels in UTC: "13:00" inside a day, "Oct 28" at a new day. */
function tickLabel(seconds: number, type: TickMarkType) {
  const options: Intl.DateTimeFormatOptions =
    type === TickMarkType.Year
      ? { year: "numeric" }
      : type === TickMarkType.Month
        ? { month: "short" }
        : type === TickMarkType.DayOfMonth
          ? { month: "short", day: "numeric" }
          : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  return new Date(seconds * 1000).toLocaleString("en-US", {
    ...options,
    timeZone: "UTC",
  });
}

const price = (value: number) => usdPrice(String(value));
/** The axis pads below the lowest candle; a price is never negative. */
const axisPrice = (value: number) => (value < 0 ? "" : price(value));
/** Room above the candles for the legend, which wraps on phones. */
const priceMargins = (width: number) => ({
  top: width < 560 ? 0.2 : 0.1,
  bottom: 0.24,
});

/**
 * OHLCV chart on TradingView's open-source Lightweight Charts: drag to move,
 * wheel or pinch to zoom, axes in UTC with dates. Empty buckets stay empty
 * slots on the time axis; nothing is interpolated. It opens on the newest
 * candles, and older history is one drag or zoom away.
 */
export default function CandleChart({
  series,
  interval,
  mode,
  pairLabel,
}: {
  series: ChartSeries;
  interval: CandleInterval;
  mode: "candles" | "line";
  pairLabel: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<ChartApi | null>(null);
  const slots = useRef<ChartSlot[]>(series.slots);
  const placed = useRef(false);
  const [hovered, setHovered] = useState<ChartSlot | null>(null);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [logScale, setLogScale] = useState(false);

  const resetView = useCallback(() => {
    const current = api.current;
    if (!current) return;
    const total = slots.current.length;
    const bars = initialBars(host.current?.clientWidth ?? 600, total);
    current.chart.priceScale("right").applyOptions({ autoScale: true });
    if (bars >= total) current.chart.timeScale().fitContent();
    else
      current.chart.timeScale().setVisibleLogicalRange({
        from: total - bars,
        to: total - 1 + RIGHT_OFFSET,
      });
  }, []);

  // One chart per interval; refreshes only replace its data.
  useEffect(() => {
    const element = host.current!;
    const chart = createChart(element, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#7e91b4",
        fontSize: 10,
        fontFamily: getComputedStyle(element).fontFamily,
        // Lightweight Charts is Apache-2.0; its notice asks for this link.
        attributionLogo: true,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "#283248", style: LineStyle.Dashed },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: priceMargins(element.clientWidth),
      },
      timeScale: {
        borderVisible: false,
        rightOffset: RIGHT_OFFSET,
        barSpacing: 7,
        minBarSpacing: 0.5,
        fixLeftEdge: true,
        lockVisibleTimeRangeOnResize: true,
        timeVisible: interval !== "1d",
        secondsVisible: false,
        tickMarkFormatter: (time: unknown, type: TickMarkType) =>
          tickLabel(Number(time), type),
      },
      // Vertical swipes keep scrolling the page on phones.
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },
      localization: {
        locale: "en-US",
        priceFormatter: axisPrice,
        timeFormatter: (time: unknown) => slotTime(Number(time), interval),
      },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
    });
    const line = chart.addSeries(LineSeries, {
      color: "#7da1ff",
      lineWidth: 2,
      visible: false,
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    // Every slot, empty or not, is one logical index on the time axis.
    chart.subscribeCrosshairMove(({ time, logical }) =>
      setHovered(
        time !== undefined && logical !== undefined
          ? (slots.current[Math.round(logical)] ?? null)
          : null,
      ),
    );
    chart
      .timeScale()
      .subscribeVisibleLogicalRangeChange((visible) =>
        setRange(visible ? { from: visible.from, to: visible.to } : null),
      );
    chart
      .timeScale()
      .subscribeSizeChange((width) =>
        chart
          .priceScale("right")
          .applyOptions({ scaleMargins: priceMargins(width) }),
      );
    api.current = { chart, candles, line, volume };
    placed.current = false;
    return () => {
      api.current = null;
      chart.remove();
    };
  }, [interval]);

  useEffect(() => {
    const current = api.current;
    if (!current) return;
    slots.current = series.slots;
    const time = (slot: ChartSlot) => slot.time as UTCTimestamp;
    current.candles.setData(
      series.slots.map((slot) =>
        slot.candle
          ? {
              time: time(slot),
              open: slot.candle.open,
              high: slot.candle.high,
              low: slot.candle.low,
              close: slot.candle.close,
            }
          : { time: time(slot) },
      ),
    );
    current.line.setData(
      series.slots.map((slot) =>
        slot.candle
          ? { time: time(slot), value: slot.candle.close }
          : { time: time(slot) },
      ),
    );
    current.volume.setData(
      series.slots.map((slot) =>
        slot.candle
          ? {
              time: time(slot),
              value: slot.candle.volumeUsd,
              color:
                slot.candle.close >= slot.candle.open ? UP_VOLUME : DOWN_VOLUME,
            }
          : { time: time(slot) },
      ),
    );
    const priceFormat = {
      type: "custom" as const,
      formatter: axisPrice,
      minMove: priceStep(
        series.slots.flatMap((slot) => (slot.candle ? [slot.candle] : [])),
      ),
    };
    current.candles.applyOptions({ priceFormat });
    current.line.applyOptions({ priceFormat });
    // Refreshes keep the reader's zoom; only a new chart's first data sets
    // the view.
    if (!placed.current) {
      placed.current = true;
      resetView();
    }
  }, [series, interval, resetView]);

  // Also re-applied to the new chart when the interval changes.
  useEffect(() => {
    api.current?.candles.applyOptions({ visible: mode === "candles" });
    api.current?.line.applyOptions({ visible: mode === "line" });
  }, [mode, interval]);

  useEffect(() => {
    api.current?.chart.priceScale("right").applyOptions({
      mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }, [logScale, interval]);

  const candles = series.slots.flatMap((slot) =>
    slot.candle ? [slot.candle] : [],
  );
  const first = candles[0];
  const last = candles.at(-1);
  const shown = hovered ?? series.slots.at(-1) ?? null;
  const summary =
    first && last
      ? `${pairLabel} ${interval} candles in USD from ${slotTime(first.time, interval)} to ${slotTime(last.time, interval)}. Low ${price(Math.min(...candles.map((c) => c.low)))}, high ${price(Math.max(...candles.map((c) => c.high)))}, last close ${price(last.close)}.`
      : `${pairLabel} ${interval} chart with no candles.`;
  return (
    <>
      <div
        className="price-chart"
        data-visible-from={range ? range.from.toFixed(1) : undefined}
        data-visible-to={range ? range.to.toFixed(1) : undefined}
      >
        <div
          ref={host}
          className="price-chart-canvas"
          role="img"
          aria-label={summary}
        />
        {shown ? (
          <div className="chart-legend" aria-hidden="true">
            <span className="muted">{slotTime(shown.time, interval)}</span>
            {shown.candle ? (
              <dl
                className={
                  shown.candle.close >= shown.candle.open
                    ? "positive"
                    : "negative"
                }
              >
                <dt>O</dt>
                <dd>{price(shown.candle.open)}</dd>
                <dt>H</dt>
                <dd>{price(shown.candle.high)}</dd>
                <dt>L</dt>
                <dd>{price(shown.candle.low)}</dd>
                <dt>C</dt>
                <dd>{price(shown.candle.close)}</dd>
                <dt>Vol</dt>
                <dd>{usdAmount(String(shown.candle.volumeUsd))}</dd>
              </dl>
            ) : (
              <span>No trades in this interval</span>
            )}
          </div>
        ) : null}
      </div>
      <div className="chart-controls">
        <span className="tiny muted">
          Drag to move · scroll or pinch to zoom
        </span>
        <div>
          <button
            onClick={() => setLogScale(!logScale)}
            aria-pressed={logScale}
            title="Logarithmic price scale"
          >
            Log
          </button>
          <button onClick={resetView} title="Back to the newest candles">
            <RotateCcw size={11} />
            Reset view
          </button>
        </div>
      </div>
    </>
  );
}
