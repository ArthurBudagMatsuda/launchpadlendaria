"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PricePoint } from "@/types/token";
import { usd } from "@/lib/format";
import { EmptyState } from "@/components/ui/feedback";
const timeLabel = (time: string) =>
  new Date(time).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
export default function PriceChart({
  data,
  mode,
}: {
  data: PricePoint[];
  mode: "area" | "line";
}) {
  if (!data.length)
    return (
      <EmptyState title="No chart data">
        A price history is not available for this token.
      </EmptyState>
    );
  const axes = (
    <>
      <CartesianGrid stroke="#283248" strokeDasharray="3 5" vertical={false} />
      <XAxis
        dataKey="time"
        tickFormatter={timeLabel}
        tick={{ fill: "#7e91b4", fontSize: 9 }}
        tickLine={false}
        axisLine={false}
        minTickGap={60}
      />
      <YAxis
        orientation="right"
        tickFormatter={(v) => usd(v, false)}
        tick={{ fill: "#7e91b4", fontSize: 9 }}
        tickLine={false}
        axisLine={false}
        width={80}
        domain={["auto", "auto"]}
      />
      <Tooltip
        content={({ active, payload, label }) =>
          active && payload?.length ? (
            <div className="chart-tooltip">
              <span className="muted">
                {timeLabel(String(label))} UTC · Demo
              </span>
              <br />
              <strong>{usd(Number(payload[0].value), false)}</strong>
            </div>
          ) : null
        }
      />
    </>
  );
  return (
    <div
      className="price-chart"
      role="img"
      aria-label="Demonstration price history. Values are fictional, displayed in USD."
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={0}
      >
        {mode === "area" ? (
          <AreaChart
            data={data}
            margin={{ top: 15, right: 8, left: 12, bottom: 0 }}
          >
            <defs>
              <linearGradient id="price-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#477bff" stopOpacity={0.27} />
                <stop offset="100%" stopColor="#477bff" stopOpacity={0} />
              </linearGradient>
            </defs>
            {axes}
            <Area
              type="linear"
              dataKey="price"
              stroke="#749cff"
              strokeWidth={2}
              fill="url(#price-fill)"
              isAnimationActive={false}
            />
          </AreaChart>
        ) : (
          <LineChart
            data={data}
            margin={{ top: 15, right: 8, left: 12, bottom: 0 }}
          >
            {axes}
            <Line
              type="linear"
              dataKey="price"
              stroke="#7da1ff"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
