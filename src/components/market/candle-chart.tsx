"use client";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Candle, CandleInterval } from "@/lib/market/types";
import { usdAmount, usdPrice } from "@/lib/format";
import { EmptyState } from "@/components/ui/feedback";

export const INTERVAL_SECONDS: Record<CandleInterval, number> = {
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14_400,
  "1d": 86_400,
};

interface Row {
  time: number;
  candle: Candle | null;
  range: [number, number] | null;
  close: number | null;
  volume: number | null;
  up: boolean;
}

/**
 * Missing buckets become empty rows so the time axis keeps its spacing and
 * the gap stays visible. Nothing is interpolated: an empty row draws nothing.
 * Very sparse series are not padded beyond `maxRows`.
 */
export function rowsWithGaps(
  candles: Candle[],
  intervalSeconds: number,
  maxRows = 600,
): Row[] {
  const row = (candle: Candle): Row => ({
    time: candle.time,
    candle,
    range: [candle.low, candle.high],
    close: candle.close,
    volume: candle.volumeUsd,
    up: candle.close >= candle.open,
  });
  if (!candles.length) return [];
  const span = (candles.at(-1)!.time - candles[0].time) / intervalSeconds + 1;
  if (span > maxRows) return candles.map(row);
  const rows: Row[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    if (i > 0)
      for (
        let t = candles[i - 1].time + intervalSeconds;
        t < candles[i].time;
        t += intervalSeconds
      )
        rows.push({
          time: t,
          candle: null,
          range: null,
          close: null,
          volume: null,
          up: true,
        });
    rows.push(row(candles[i]));
  }
  return rows;
}

const UP = "#5bd5a3";
const DOWN = "#f07787";

function timeLabel(seconds: number, interval: CandleInterval) {
  const date = new Date(seconds * 1000);
  return interval === "4h" || interval === "1d"
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      });
}

/** Wick from high to low and a body from open to close, inside the bar's box. */
function CandleShape(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: Row;
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  const candle = payload?.candle;
  if (!candle) return null;
  const color = payload.up ? UP : DOWN;
  const span = candle.high - candle.low;
  const toY = (value: number) =>
    span > 0 ? y + ((candle.high - value) / span) * height : y;
  const top = toY(Math.max(candle.open, candle.close));
  const bottom = toY(Math.min(candle.open, candle.close));
  const bodyWidth = Math.max(1, Math.min(width * 0.7, 12));
  const center = x + width / 2;
  return (
    <g>
      <line
        x1={center}
        x2={center}
        y1={y}
        y2={y + height}
        stroke={color}
        strokeWidth={1}
      />
      <rect
        x={center - bodyWidth / 2}
        y={top}
        width={bodyWidth}
        height={Math.max(1, bottom - top)}
        fill={color}
      />
    </g>
  );
}

export default function CandleChart({
  candles,
  interval,
  mode,
  pairLabel,
}: {
  candles: Candle[];
  interval: CandleInterval;
  mode: "candles" | "line";
  pairLabel: string;
}) {
  const rows = useMemo(
    () => rowsWithGaps(candles, INTERVAL_SECONDS[interval]),
    [candles, interval],
  );
  if (!candles.length)
    return (
      <EmptyState title="No candles for this interval">
        The provider has no trades recorded for this pool in this window. No
        prices are drawn where nothing was observed.
      </EmptyState>
    );
  const lows = candles.map((c) => c.low);
  const highs = candles.map((c) => c.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const pad = (max - min) * 0.08 || max * 0.02;
  const maxVolume = Math.max(...candles.map((c) => c.volumeUsd), 0);
  const first = candles[0];
  const last = candles.at(-1)!;
  return (
    <div
      className="price-chart"
      role="img"
      aria-label={`${pairLabel} ${interval} candles in USD from ${new Date(first.time * 1000).toUTCString()} to ${new Date(last.time * 1000).toUTCString()}. Low ${usdPrice(String(min))}, high ${usdPrice(String(max))}, last close ${usdPrice(String(last.close))}.`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={0}
      >
        <ComposedChart
          data={rows}
          margin={{ top: 15, right: 8, left: 12, bottom: 0 }}
          barCategoryGap="15%"
        >
          <CartesianGrid
            stroke="#283248"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tickFormatter={(t) => timeLabel(Number(t), interval)}
            tick={{ fill: "#7e91b4", fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            minTickGap={60}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            domain={[Math.max(0, min - pad), max + pad]}
            tickFormatter={(v) => usdPrice(String(v))}
            tick={{ fill: "#7e91b4", fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            width={80}
            allowDataOverflow
          />
          <YAxis yAxisId="volume" hide domain={[0, maxVolume * 4 || 1]} />
          <Tooltip
            cursor={{ stroke: "#5e78b8", strokeDasharray: "3 3" }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as Row | undefined;
              if (!active || !row) return null;
              const c = row.candle;
              return (
                <div className="chart-tooltip">
                  <span className="muted">
                    {new Date(row.time * 1000)
                      .toUTCString()
                      .replace(" GMT", " UTC")}
                  </span>
                  {c ? (
                    <dl className="ohlc">
                      <dt>O</dt>
                      <dd>{usdPrice(String(c.open))}</dd>
                      <dt>H</dt>
                      <dd>{usdPrice(String(c.high))}</dd>
                      <dt>L</dt>
                      <dd>{usdPrice(String(c.low))}</dd>
                      <dt>C</dt>
                      <dd className={row.up ? "positive" : "negative"}>
                        {usdPrice(String(c.close))}
                      </dd>
                      <dt>Vol</dt>
                      <dd>{usdAmount(String(c.volumeUsd))}</dd>
                    </dl>
                  ) : (
                    <p>No trades in this interval.</p>
                  )}
                </div>
              );
            }}
          />
          <Bar
            yAxisId="volume"
            dataKey="volume"
            isAnimationActive={false}
            maxBarSize={12}
          >
            {rows.map((row) => (
              <Cell key={row.time} fill={row.up ? `${UP}40` : `${DOWN}40`} />
            ))}
          </Bar>
          {mode === "candles" ? (
            <Bar
              yAxisId="price"
              dataKey="range"
              isAnimationActive={false}
              shape={<CandleShape />}
              maxBarSize={14}
            />
          ) : (
            <Line
              yAxisId="price"
              type="linear"
              dataKey="close"
              stroke="#7da1ff"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
