"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CandlestickChart, ChartNoAxesCombined } from "lucide-react";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { ErrorNote, SourceLine } from "@/components/market/primitives";
import { Button } from "@/components/ui/button";
import { HISTORY_PAGE, POOL_REFRESH_MS } from "@/hooks/use-retry";
import { ago, shorten } from "@/lib/format";
import { sol, tokens } from "@/lib/meteora/format";
import {
  candlesFromTrades,
  type ActivityKind,
  type PoolActivity,
} from "@/lib/meteora/history";
import type { RetryPool } from "@/lib/meteora/pools";
import type { TradeVenue } from "@/lib/meteora/quotes";
import { ExplorerLink } from "./launch-ui";

const CandleChart = dynamic(() => import("@/components/market/candle-chart"), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

const INTERVALS = { "5m": 300, "15m": 900, "1h": 3_600, "1d": 86_400 } as const;
type Interval = keyof typeof INTERVALS;

const VENUES: Record<TradeVenue, string> = {
  dbc: "Bonding curve",
  "damm-v2": "DAMM v2",
};

export interface LaunchHistory {
  items: PoolActivity[];
  isPending: boolean;
  isError: boolean;
  retrievedAt: number;
  hasMore: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
  refetch: () => void;
}

/**
 * Candles from the launch's own decoded trades, per venue: the curve's and
 * the DAMM v2 pool's prices are never joined into one series. A bucket with
 * no trade is skipped, never filled.
 */
export function LaunchChart({
  pool,
  symbol,
  history,
}: {
  pool: RetryPool;
  symbol: string;
  history: LaunchHistory;
}) {
  const graduated = pool.status === "graduated";
  const [venue, setVenue] = useState<TradeVenue>(graduated ? "damm-v2" : "dbc");
  const [interval, setInterval] = useState<Interval>("5m");
  const [mode, setMode] = useState<"candles" | "line">("candles");
  const shown: TradeVenue = graduated ? venue : "dbc";
  const candles = useMemo(
    () => candlesFromTrades(history.items, shown, INTERVALS[interval]),
    [history.items, shown, interval],
  );
  return (
    <section className="panel chart-panel">
      <div className="chart-toolbar">
        <div className="chart-intervals">
          {(Object.keys(INTERVALS) as Interval[]).map((value) => (
            <button
              key={value}
              aria-pressed={interval === value}
              className={interval === value ? "active" : ""}
              onClick={() => setInterval(value)}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>
        {graduated ? (
          <div className="segmented" aria-label="Price source">
            {(Object.keys(VENUES) as TradeVenue[]).map((value) => (
              <button
                key={value}
                aria-pressed={shown === value}
                className={shown === value ? "active" : ""}
                onClick={() => setVenue(value)}
              >
                {VENUES[value]}
              </button>
            ))}
          </div>
        ) : null}
        <div className="segmented">
          <button
            className={mode === "candles" ? "active" : ""}
            onClick={() => setMode("candles")}
            aria-label="Candlestick chart"
          >
            <CandlestickChart size={15} />
          </button>
          <button
            className={mode === "line" ? "active" : ""}
            onClick={() => setMode("line")}
            aria-label="Line chart"
          >
            <ChartNoAxesCombined size={15} />
          </button>
        </div>
      </div>
      {candles.length ? (
        <CandleChart
          candles={candles}
          interval={interval}
          mode={mode}
          unit="sol"
          pairLabel={`${symbol}/SOL on the ${VENUES[shown]}`}
          ath={null}
          onReachStart={
            history.hasMore && !history.loadingOlder
              ? history.loadOlder
              : undefined
          }
        />
      ) : (
        <EmptyState
          title={
            history.isError
              ? "Price history unavailable"
              : history.isPending
                ? "Reading trades…"
                : "No trades yet"
          }
        >
          Candles are built from this token&apos;s own buys and sells, decoded
          from Meteora&apos;s on-chain events. Nothing is drawn before the first
          trade, and no price is estimated.
        </EmptyState>
      )}
      {history.retrievedAt ? (
        <SourceLine
          source="solana-rpc"
          retrievedAt={history.retrievedAt}
          refreshMs={POOL_REFRESH_MS * 3}
          refreshFailed={history.isError}
          detail={`${VENUES[shown]} trades decoded from Meteora events, prices in SOL${history.hasMore ? " · drag left for older trades" : ""}`}
        />
      ) : null}
    </section>
  );
}

const KIND_LABELS: Record<ActivityKind, string> = {
  create: "Launch",
  buy: "Buy",
  sell: "Sell",
  graduate: "Graduation",
  claim: "Fee claim",
  other: "Other",
};

/** The launch's transactions, each classified by the event it emitted. */
export function ActivityTable({
  pool,
  history,
}: {
  pool: RetryPool;
  history: LaunchHistory;
}) {
  if (history.isError && !history.items.length)
    return (
      <ErrorNote
        message="Activity unavailable from Solana RPC."
        onRetry={history.refetch}
      />
    );
  if (!history.items.length)
    return (
      <EmptyState
        title={history.isPending ? "Reading activity…" : "No activity yet"}
      >
        Every transaction that touched this token&apos;s pools, read from Solana
        RPC and classified by the event Meteora&apos;s program emitted.
      </EmptyState>
    );
  return (
    <>
      <div className="table-scroll">
        <table className="activity-table">
          <caption className="sr-only">
            Transactions that touched this token&apos;s pools, newest first.
          </caption>
          <thead>
            <tr>
              <th>Type</th>
              <th>SOL</th>
              <th>Tokens</th>
              <th>Wallet</th>
              <th>Time</th>
              <th>Transaction</th>
            </tr>
          </thead>
          <tbody>
            {history.items.map((item) => (
              <tr key={item.signature} className={item.kind}>
                <td
                  className={
                    item.failed
                      ? "negative"
                      : item.kind === "buy"
                        ? "positive"
                        : item.kind === "sell"
                          ? "negative"
                          : undefined
                  }
                >
                  {item.failed ? "Failed" : KIND_LABELS[item.kind]}
                  {item.venue && !item.failed && item.kind !== "other" ? (
                    <span className="muted tiny"> · {VENUES[item.venue]}</span>
                  ) : null}
                </td>
                <td>{item.solAmount != null ? sol(item.solAmount) : "—"}</td>
                <td>
                  {item.tokenAmount != null ? tokens(item.tokenAmount) : "—"}
                </td>
                <td>{item.trader ? shorten(item.trader) : "—"}</td>
                <td>{item.time ? ago(item.time * 1000) : "—"}</td>
                <td>
                  <ExplorerLink
                    cluster={pool.cluster}
                    kind="tx"
                    value={item.signature}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {history.hasMore ? (
        <Button
          variant="secondary"
          onClick={history.loadOlder}
          disabled={history.loadingOlder}
        >
          {history.loadingOlder ? "Loading…" : "Load older"}
        </Button>
      ) : null}
      <p className="tiny">
        {HISTORY_PAGE} transactions per pool per page. A transaction without a
        Meteora event for this token (a token transfer, a failed attempt) is
        listed as &quot;Other&quot; or &quot;Failed&quot;, never as a trade.
      </p>
    </>
  );
}
