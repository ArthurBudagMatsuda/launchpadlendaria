"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  ChartArea,
  ChartNoAxesCombined,
  Copy,
  Info,
  Link2,
} from "lucide-react";
import type { PricePoint, Token, Trade } from "@/types/token";
import { usd, number, percent, age } from "@/lib/format";
import { tokenProvider } from "@/services/token-provider";
import { TokenAvatar, BondingProgress } from "@/components/tokens/token-card";
import { DemoLabel, LoadingSkeleton } from "@/components/ui/feedback";
import { TradePanel } from "./trade-panel";
import { useApp } from "@/components/providers";
const PriceChart = dynamic(() => import("./price-chart"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 330 }}>
      <LoadingSkeleton />
    </div>
  ),
});
export function Terminal({
  token,
  initialHistory,
  trades,
}: {
  token: Token;
  initialHistory: PricePoint[];
  trades: Trade[];
}) {
  const [interval, setInterval] = useState("1H");
  const [mode, setMode] = useState<"area" | "line">("area");
  const [copied, setCopied] = useState(false);
  const { notify } = useApp();
  const {
    data: history = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["price-history", token.id, interval],
    queryFn: () => tokenProvider.history(token.id, interval),
    initialData: interval === "1H" ? initialHistory : undefined,
    staleTime: Infinity,
  });
  async function copyReference() {
    try {
      await navigator.clipboard.writeText(
        token.contractAddress ?? token.demoReference,
      );
      setCopied(true);
      notify(
        token.contractAddress
          ? "Contract address copied."
          : "Demo reference copied. This token has no deployed contract.",
      );
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify(
        "Clipboard unavailable. Copy the displayed reference manually.",
        true,
      );
    }
  }
  const v = token.market;
  const status =
    token.launch.stage === "new"
      ? "New creation"
      : token.launch.stage === "graduating"
        ? "About to graduate"
        : "Graduated";
  return (
    <div className="trade-page">
      <Link href="/" className="back-link">
        <ArrowLeft size={14} />
        Back to Discover
      </Link>
      <div className="token-detail-heading">
        <TokenAvatar token={token} size={60} />
        <div>
          <h1>
            {token.metadata.name} <span>{token.metadata.symbol}</span>
          </h1>
          <p>
            <span className={`status-label ${token.launch.stage}`}>
              {status}
            </span>
            <span>Created {age(token.launch.createdAt)} ago · demo</span>
            <button className="reference-button" onClick={copyReference}>
              {token.contractAddress ?? token.demoReference}
              <Copy size={11} />
              {copied ? "Copied" : ""}
            </button>
            {token.contractAddress && !token.isDemo ? (
              <a
                href={`https://basescan.org/address/${token.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="reference-button"
              >
                Explorer
                <ArrowUpRight size={11} />
              </a>
            ) : null}
          </p>
        </div>
        <DemoLabel />
      </div>
      <div className="market-stats">
        {[
          { label: "Market cap", value: usd(v.marketCap), change: true },
          { label: "Price", value: usd(v.priceUsd, false) },
          { label: "Volume 24h", value: usd(v.volume24h) },
          { label: "Liquidity", value: usd(v.liquidity) },
          { label: "Holders", value: number(v.holders) },
          { label: "Bonding curve", value: `${token.launch.curve.progress}%` },
        ].map((stat) => (
          <div className="market-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            {stat.change ? (
              <span
                className={`stat-change ${v.change24h >= 0 ? "positive" : "negative"}`}
              >
                {percent(v.change24h)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="terminal-grid">
        <div className="terminal-main">
          <section className="panel chart-panel">
            <div className="panel-heading">
              <h2>
                {token.metadata.symbol} / USD
                <span className="tiny muted ml-2">Simulated market</span>
              </h2>
              <DemoLabel />
            </div>
            <div className="chart-toolbar">
              <div>
                {["1H", "4H", "1D", "1W"].map((i) => (
                  <button
                    key={i}
                    onClick={() => setInterval(i)}
                    className={interval === i ? "active" : ""}
                    aria-pressed={interval === i}
                  >
                    {i}
                  </button>
                ))}
              </div>
              <button
                className="chart-type"
                onClick={() => setMode(mode === "area" ? "line" : "area")}
              >
                {mode === "area" ? (
                  <ChartArea size={13} />
                ) : (
                  <ChartNoAxesCombined size={13} />
                )}
                {mode === "area" ? "Area" : "Line"}
              </button>
            </div>
            {isPending ? (
              <LoadingSkeleton />
            ) : isError ? (
              <div className="empty-state">
                <p>Couldn’t load the demo history.</p>
                <button
                  className="button button-secondary"
                  onClick={() => refetch()}
                >
                  Retry
                </button>
              </div>
            ) : (
              <PriceChart data={history} mode={mode} />
            )}
            <p className="chart-caption">
              <Info size={12} />
              Deterministic demo series · UTC · Not a live market feed
            </p>
          </section>
          <section className="panel activity-panel">
            <div className="panel-heading">
              <h2>Recent activity</h2>
              <DemoLabel />
            </div>
            <div className="table-scroll">
              <table className="activity-table">
                <caption className="sr-only">
                  Fictional trades for {token.metadata.name}. No transactions
                  were executed.
                </caption>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount ({token.metadata.symbol})</th>
                    <th>Price (USD)</th>
                    <th>Wallet · Demo</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <span
                          className={`trade-side ${t.side === "buy" ? "positive" : "negative"}`}
                        >
                          {t.side === "buy" ? (
                            <ArrowDownLeft size={12} />
                          ) : (
                            <ArrowUpRight size={12} />
                          )}
                          {t.side}
                        </span>
                      </td>
                      <td>{number(t.amount)}</td>
                      <td>{usd(t.priceUsd, false)}</td>
                      <td>{t.walletLabel}</td>
                      <td>{t.minutesAgo}m ago</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <aside className="terminal-aside">
          <TradePanel token={token} />
          <section className="panel trade-info">
            <h3>About {token.metadata.name}</h3>
            <p>{token.metadata.description}</p>
            <BondingProgress
              progress={token.launch.curve.progress}
              graduated={token.launch.stage === "graduated"}
            />
            <dl className="detail-list">
              <div>
                <dt>Network</dt>
                <dd>Base · Demo token</dd>
              </div>
              <div>
                <dt>Creator</dt>
                <dd>{token.launch.creatorLabel}</dd>
              </div>
              <div>
                <dt>Contract</dt>
                <dd>Not deployed</dd>
              </div>
              <div>
                <dt>Graduation</dt>
                <dd>Demo progress only</dd>
              </div>
              <div>
                <dt>Social links</dt>
                <dd>Not provided</dd>
              </div>
            </dl>
            <p className="tiny mt-5 flex items-center gap-1.5">
              <Link2 size={12} />
              No external links for fictional tokens.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
