"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CandlestickChart,
  ChartNoAxesCombined,
} from "lucide-react";
import { CLUSTERS, explorerUrl } from "@/config/solana";
import {
  useCandles,
  useCandleHistory,
  useMarketTrades,
  useOnchainToken,
  useTokenMarket,
  POOLS_REFRESH_MS,
  CANDLE_REFRESH_MS,
  TRADES_REFRESH_MS,
} from "@/hooks/use-solana-market";
import { highestHigh } from "@/lib/market/chart-series";
import { computeFdvUsd, tokenAmount as rawAmount } from "@/lib/market/metrics";
import type { CandleInterval, TokenRef } from "@/lib/market/types";
import { TOKEN_PROGRAM } from "@/lib/solana/rpc";
import {
  ago,
  shorten,
  tokenAmount,
  tokenSupply,
  usdAmount,
  usdPrice,
  quotePrice,
} from "@/lib/format";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { TradePanel } from "@/components/trade/trade-panel";
import {
  CopyAddress,
  ErrorNote,
  SourceLine,
  TokenMark,
  Unavailable,
} from "./primitives";
const CandleChart = dynamic(() => import("./candle-chart"), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});
const INTERVALS: CandleInterval[] = ["5m", "15m", "1h", "4h", "1d"];
export function SolanaTokenTerminal({ token }: { token: TokenRef }) {
  const onchain = useOnchainToken(token);
  const facts = onchain.data;
  const market = useTokenMarket(token, undefined, facts?.verdict === "token");
  const primary = market.data?.selection.primary;
  const [interval, setInterval] = useState<CandleInterval>("1h");
  const [mode, setMode] = useState<"candles" | "line">("candles");
  const [tab, setTab] = useState("activity");
  const history = useCandleHistory(token, primary?.pool.id, interval);
  const candles = history.newest;
  const series = history.data;
  const daily = useCandles(token, primary?.pool.id, "1d");
  const activity = useMarketTrades(token, primary?.pool.id);
  const symbol =
    primary?.pool.baseToken.symbol && primary.pool.baseToken.symbol !== "Token"
      ? primary.pool.baseToken.symbol
      : "Token";
  const ath = highestHigh(daily.data?.candles ?? [], series?.candles ?? []);
  const fdv = computeFdvUsd(
    facts?.totalSupply ?? null,
    facts?.decimals ?? null,
    primary?.priceUsd ?? null,
  );
  const figure = (
    value: string | null | undefined,
    format: (value: string) => string,
  ) =>
    value != null ? (
      format(value)
    ) : (
      <Unavailable>Not reported by a verified data source</Unavailable>
    );
  return (
    <div className="trade-page">
      <Link href="/" className="back-link">
        <ArrowLeft size={14} />
        Back to Discover
      </Link>
      <div className="token-detail-heading">
        <TokenMark
          address={token.address}
          symbol={facts?.symbol ?? null}
          size={60}
        />
        <div>
          <h1>{shorten(token.address)}</h1>
          <p>
            <span className="status-label tracked">Untracked mint lookup</span>
            <span>{CLUSTERS[token.cluster].label}</span>
            <CopyAddress address={token.address} />
            <a
              className="reference-button"
              href={explorerUrl(token.cluster, "address", token.address)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Solana Explorer
              <ArrowUpRight size={11} />
            </a>
          </p>
        </div>
      </div>
      {onchain.isError ? (
        <ErrorNote
          message="Mint identity unavailable from Solana RPC. No token identity is inferred."
          onRetry={() => onchain.refetch()}
        />
      ) : null}
      {onchain.isError && !facts ? null : onchain.isPending ? (
        <LoadingSkeleton />
      ) : facts?.verdict !== "token" ? (
        <EmptyState
          title={
            facts?.verdict === "missing"
              ? "No account on this cluster"
              : "This account is not an initialized SPL mint"
          }
        >
          A valid base58 address is not proof of a token. The owning program and
          mint data must pass validation.
        </EmptyState>
      ) : (
        <>
          <div className="market-stats">
            {[
              {
                label: "Price USD",
                value: figure(primary?.priceUsd, usdPrice),
              },
              {
                label: `Price ${primary?.pool.quoteToken.symbol ?? "quote"}`,
                value: figure(primary?.priceQuote, (value) =>
                  quotePrice(value, primary?.pool.quoteToken.symbol ?? "Quote"),
                ),
              },
              {
                label: "Volume 24h",
                value: figure(primary?.volumeUsd.h24, usdAmount),
              },
              {
                label: "Liquidity",
                value: figure(primary?.liquidityUsd, usdAmount),
              },
              { label: "FDV", value: figure(fdv, usdAmount) },
              {
                label: "Market cap",
                value: (
                  <Unavailable>Circulating supply is not verified</Unavailable>
                ),
              },
            ].map((item) => (
              <div className="market-stat" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          {token.cluster === "devnet" ? (
            <div className="notice-strip mb-5">
              Market data unavailable on Devnet. Mainnet prices are never
              substituted.
            </div>
          ) : market.isError ? (
            <ErrorNote
              message="Market data unavailable. No prices or candles are estimated."
              onRetry={() => market.refetch()}
            />
          ) : !market.isPending && !primary ? (
            <div className="notice-strip mb-5">
              No eligible Solana market reported for this mint.
            </div>
          ) : null}
          {market.data ? (
            <SourceLine
              source={market.data.source}
              retrievedAt={market.data.retrievedAt}
              refreshMs={POOLS_REFRESH_MS}
              fallback={market.data.fallbackUsed}
              refreshFailed={market.isError}
              detail="Indexed public market data; not an executable quote"
            />
          ) : null}
          <div className="terminal-grid">
            <div className="terminal-main">
              <section className="panel chart-panel">
                <div className="chart-toolbar">
                  <div className="chart-intervals">
                    {INTERVALS.map((value) => (
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
                {series?.candles.length ? (
                  <CandleChart
                    candles={series.candles}
                    interval={interval}
                    mode={mode}
                    pairLabel={
                      primary
                        ? `${symbol}/${primary.pool.quoteToken.symbol}`
                        : "Solana market"
                    }
                    ath={ath}
                    onReachStart={history.loadOlder}
                  />
                ) : (
                  <EmptyState
                    title={
                      candles.isError
                        ? "Price history unavailable"
                        : "No price history available"
                    }
                  >
                    No validated price history is available for this mint on the
                    selected cluster.
                  </EmptyState>
                )}
                {ath ? (
                  <p className="tiny">
                    Highest observed price: {usdPrice(String(ath.price))}. Based
                    only on the available daily and intraday history.
                  </p>
                ) : null}
                {candles.data ? (
                  <SourceLine
                    source={candles.data.provenance.source}
                    retrievedAt={candles.data.provenance.retrievedAt}
                    refreshMs={CANDLE_REFRESH_MS[interval]}
                    refreshFailed={candles.isError}
                    detail={`OHLCV price history${history.loadingOlder ? " · loading older candles" : history.olderFailed ? " · older candles unavailable" : ""}${series?.gaps ? ` · ${series.gaps} intervals without trades` : ""}`}
                  />
                ) : null}
              </section>
              <section className="panel activity-panel">
                <nav className="portfolio-tabs" aria-label="Token information">
                  <button
                    className={tab === "activity" ? "active" : ""}
                    onClick={() => setTab("activity")}
                  >
                    Activity
                  </button>
                  <button
                    className={tab === "pools" ? "active" : ""}
                    onClick={() => setTab("pools")}
                  >
                    Pools
                  </button>
                </nav>
                {tab === "activity" && activity.data ? (
                  <SourceLine
                    source={activity.data.provenance.source}
                    retrievedAt={activity.data.provenance.retrievedAt}
                    refreshMs={TRADES_REFRESH_MS}
                    refreshFailed={activity.isError}
                    detail="Public pool activity"
                  />
                ) : null}
                {tab === "activity" && activity.isError ? (
                  <ErrorNote
                    message="Market activity unavailable from the indexer."
                    onRetry={() => activity.refetch()}
                  />
                ) : null}
                {tab === "activity" ? (
                  activity.data?.trades.length ? (
                    <div className="table-scroll">
                      <table className="activity-table">
                        <caption className="sr-only">
                          Public Solana pool swaps indexed by GeckoTerminal.
                        </caption>
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Side</th>
                            <th>Amount</th>
                            <th>Transaction</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activity.data.trades.map((trade) => (
                            <tr key={trade.id}>
                              <td>{ago(trade.time)}</td>
                              <td
                                className={
                                  trade.side === "buy" ? "positive" : "negative"
                                }
                              >
                                {trade.side}
                              </td>
                              <td>{tokenAmount(trade.tokenAmount)}</td>
                              <td>
                                <a
                                  href={explorerUrl(
                                    token.cluster,
                                    "tx",
                                    trade.signature,
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {shorten(trade.signature)}
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState title="No activity available">
                      This is public market activity, not the connected wallet’s
                      history.
                    </EmptyState>
                  )
                ) : market.data?.pools.length ? (
                  <div className="table-scroll">
                    <table className="activity-table">
                      <caption className="sr-only">
                        Indexed Solana markets for this mint.
                      </caption>
                      <thead>
                        <tr>
                          <th>Pool</th>
                          <th>DEX</th>
                          <th>Liquidity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {market.data.pools.map((pool) => (
                          <tr key={pool.pool.id}>
                            <td>
                              <a
                                href={explorerUrl(
                                  token.cluster,
                                  "address",
                                  pool.pool.id,
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {shorten(pool.pool.id)}
                              </a>
                            </td>
                            <td>{pool.pool.dex}</td>
                            <td>{figure(pool.liquidityUsd, usdAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState title="No pools available">
                    No pool identity or liquidity is invented.
                  </EmptyState>
                )}
              </section>
            </div>
            <aside className="terminal-aside">
              <TradePanel
                symbol={symbol}
                token={token}
                decimals={facts.decimals}
              />
              <section className="panel trade-info">
                <h3>About this mint</h3>
                <p>
                  Mint layout and program owner are read on-chain. Names,
                  artwork and DEX listings are not safety certifications.
                </p>
                <dl className="detail-list">
                  <div>
                    <dt>Program</dt>
                    <dd>
                      {facts.tokenProgram === TOKEN_PROGRAM
                        ? "SPL Token"
                        : "Token-2022"}
                    </dd>
                  </div>
                  <div>
                    <dt>Decimals</dt>
                    <dd>{facts.decimals}</dd>
                  </div>
                  <div>
                    <dt>Supply</dt>
                    <dd>
                      {facts.totalSupply !== null && facts.decimals !== null
                        ? tokenSupply(
                            rawAmount(facts.totalSupply, facts.decimals),
                          )
                        : "N/D"}
                    </dd>
                  </div>
                  <div>
                    <dt>Mint authority</dt>
                    <dd>
                      {facts.mintAuthority
                        ? shorten(facts.mintAuthority)
                        : "None"}
                    </dd>
                  </div>
                  <div>
                    <dt>Freeze authority</dt>
                    <dd>
                      {facts.freezeAuthority
                        ? shorten(facts.freezeAuthority)
                        : "None"}
                    </dd>
                  </div>
                  <div>
                    <dt>Holders</dt>
                    <dd>Not indexed</dd>
                  </div>
                  <div>
                    <dt>RETRY graduation</dt>
                    <dd>Not applicable</dd>
                  </div>
                </dl>
                <p className="tiny">
                  Token-2022 extensions and market pool ownership require
                  separate assessment before any future execution.
                </p>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
