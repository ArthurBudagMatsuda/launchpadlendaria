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
  type PriceHigh,
} from "@/lib/market/chart-series";
import type { Candle, CandleInterval } from "@/lib/market/types";
import { usdAmount, usdPrice } from "@/lib/format";

const UP = "#5bd5a3";
const DOWN = "#f07787";
const UP_VOLUME = "rgba(91, 213, 163, 0.32)";
const DOWN_VOLUME = "rgba(240, 119, 135, 0.32)";
const ATH = "#f0b45b";
/** Empty bars kept right of the newest candle. */
const RIGHT_OFFSET = 4;
/** Older history is asked for once the view is this many bars from its start. */
const START_MARGIN = 10;

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
/**
 * Axis labels for a series whose smallest price step is `step`. The axis pads
 * below the lowest candle, down to zero and below, or to a float a hair above
 * zero such as 1.7e-21. A traded price is at least a thousand steps, so ticks
 * under half a step stay unlabeled: a "$0" tick beside $0.00001 candles read
 * as if the token had been worth nothing.
 */
const axisPrice = (step: number) => (value: number) =>
  value < step / 2 ? "" : price(value);
/** Room above the candles for the legend, which wraps on phones. */
const priceMargins = (width: number) => ({
  top: width < 560 ? 0.2 : 0.1,
  bottom: 0.24,
});

/**
 * OHLCV chart on TradingView's open-source Lightweight Charts: drag to move,
 * wheel or pinch to zoom, axes in UTC with dates. Like TradingView and GMGN,
 * candles sit side by side: an interval without trades is skipped, never
 * filled with a made-up price, and the dates on the axis show the jump. It
 * opens on the newest candles; older history is one drag or zoom away, and
 * `onReachStart` asks for the page before the oldest candle.
 */
export default function CandleChart({
  candles,
  interval,
  mode,
  pairLabel,
  ath,
  onReachStart,
}: {
  /** Oldest first, one per interval with trades. */
  candles: readonly Candle[];
  interval: CandleInterval;
  mode: "candles" | "line";
  pairLabel: string;
  ath: PriceHigh | null;
  onReachStart?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<ChartApi | null>(null);
  const drawn = useRef<readonly Candle[]>(candles);
  const placed = useRef(false);
  const [hovered, setHovered] = useState<Candle | null>(null);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [logScale, setLogScale] = useState(false);
  const reachStart = useRef(onReachStart);
  useEffect(() => {
    reachStart.current = onReachStart;
  });

  const resetView = useCallback(() => {
    const current = api.current;
    if (!current) return;
    const total = drawn.current.length;
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
      // As on TradingView and GMGN, either end can be dragged off screen and
      // zooming out goes past the whole history, down to half a pixel a bar;
      // the chart only keeps two bars in view.
      timeScale: {
        borderVisible: false,
        rightOffset: RIGHT_OFFSET,
        barSpacing: 7,
        minBarSpacing: 0.5,
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
        priceFormatter: axisPrice(priceStep(drawn.current)),
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
    // Candles sit side by side, so a logical index is a candle's index.
    chart.subscribeCrosshairMove(({ time, logical }) =>
      setHovered(
        time !== undefined && logical !== undefined
          ? (drawn.current[Math.round(logical)] ?? null)
          : null,
      ),
    );
    chart.timeScale().subscribeVisibleLogicalRangeChange((visible) => {
      setRange(visible ? { from: visible.from, to: visible.to } : null);
      if (visible && visible.from < START_MARGIN) reachStart.current?.();
    });
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
    drawn.current = candles;
    const time = (candle: Candle) => candle.time as UTCTimestamp;
    current.candles.setData(
      candles.map((candle) => ({
        time: time(candle),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );
    current.line.setData(
      candles.map((candle) => ({ time: time(candle), value: candle.close })),
    );
    current.volume.setData(
      candles.map((candle) => ({
        time: time(candle),
        value: candle.volumeUsd,
        color: candle.close >= candle.open ? UP_VOLUME : DOWN_VOLUME,
      })),
    );
    const step = priceStep(candles);
    const formatter = axisPrice(step);
    current.chart.applyOptions({ localization: { priceFormatter: formatter } });
    const priceFormat = { type: "custom" as const, formatter, minMove: step };
    current.candles.applyOptions({ priceFormat });
    current.line.applyOptions({ priceFormat });
    // Refreshes keep the reader's zoom; only a new chart's first data sets
    // the view.
    if (!placed.current) {
      placed.current = true;
      resetView();
    }
  }, [candles, interval, resetView]);

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

  // The all-time high as a dashed line, on whichever series is showing. It
  // does not stretch the scale: it shows when the view reaches its price.
  useEffect(() => {
    const current = api.current;
    if (!current || !ath) return;
    const options = {
      price: ath.price,
      color: ATH,
      lineStyle: LineStyle.Dashed,
      lineWidth: 1 as const,
      axisLabelVisible: true,
      title: "ATH",
    };
    const onCandles = current.candles.createPriceLine(options);
    const onLine = current.line.createPriceLine(options);
    return () => {
      // A new interval has already removed the old chart with its lines.
      if (api.current !== current) return;
      current.candles.removePriceLine(onCandles);
      current.line.removePriceLine(onLine);
    };
  }, [ath, interval]);

  const first = candles[0];
  const last = candles.at(-1);
  const shown = hovered ?? last ?? null;
  const summary =
    first && last
      ? `${pairLabel} ${interval} candles in USD from ${slotTime(first.time, interval)} to ${slotTime(last.time, interval)}. Low ${price(Math.min(...candles.map((c) => c.low)))}, high ${price(Math.max(...candles.map((c) => c.high)))}, last close ${price(last.close)}.${ath ? ` All-time high ${price(ath.price)} on ${slotTime(ath.time, "1d")}.` : ""}`
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
            <dl className={shown.close >= shown.open ? "positive" : "negative"}>
              <dt>O</dt>
              <dd>{price(shown.open)}</dd>
              <dt>H</dt>
              <dd>{price(shown.high)}</dd>
              <dt>L</dt>
              <dd>{price(shown.low)}</dd>
              <dt>C</dt>
              <dd>{price(shown.close)}</dd>
              <dt>Vol</dt>
              <dd>{usdAmount(String(shown.volumeUsd))}</dd>
            </dl>
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
