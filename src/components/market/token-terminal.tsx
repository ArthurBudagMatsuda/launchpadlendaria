"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  CandlestickChart,
  ChartNoAxesCombined,
  Info,
  Radar,
  ShieldAlert,
} from "lucide-react";
import type { TrackedAsset } from "@/config/featured-assets";
import {
  CANDLE_REFRESH_MS,
  POOLS_REFRESH_MS,
  TRADES_REFRESH_MS,
  useCandles,
  useMarketTrades,
  useOnchainToken,
  useTokenMarket,
} from "@/hooks/use-market";
import { chartSeries, INTERVAL_SECONDS } from "@/lib/market/chart-series";
import { errorMessage } from "@/lib/market/errors";
import {
  computeFdvUsd,
  tokenAmount as rawToAmount,
} from "@/lib/market/metrics";
import {
  explorerAddressUrl,
  explorerTokenUrl,
  explorerTxUrl,
  MARKET_NETWORKS,
} from "@/lib/market/networks";
import type { OnchainTokenFacts } from "@/lib/market/onchain";
import type {
  ExclusionReason,
  PoolSelection,
} from "@/lib/market/pool-selection";
import type { CandleInterval, PoolMarket, TokenRef } from "@/lib/market/types";
import {
  ago,
  quotePrice,
  shorten,
  signedPercent,
  tokenAmount,
  tokenSupply,
  usdAmount,
  usdPrice,
} from "@/lib/format";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { TradePanel } from "@/components/trade/trade-panel";
import { poolLabel } from "./pool-label";
import {
  CopyAddress,
  ErrorNote,
  SourceLine,
  TokenMark,
  Unavailable,
  useNow,
} from "./primitives";

const CandleChart = dynamic(() => import("./candle-chart"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 330 }}>
      <LoadingSkeleton />
    </div>
  ),
});

const INTERVALS: CandleInterval[] = ["5m", "15m", "1h", "4h", "1d"];

const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  "other-chain": "on another chain",
  "token-not-base": "list it as the quote side",
  "unsupported-quote": "priced against other tokens",
  "no-price": "without a USD price",
  "low-liquidity": "below $1,000 liquidity",
  "no-recent-trades": "without trades in 24 h",
};

function Change({ value }: { value: number | null }) {
  return (
    <span
      className={
        value === null ? "muted" : value >= 0 ? "positive" : "negative"
      }
    >
      {signedPercent(value)}
    </span>
  );
}

export function TokenTerminal({
  token,
  asset,
}: {
  token: TokenRef;
  asset?: TrackedAsset;
}) {
  const onchain = useOnchainToken(token);
  const facts = onchain.data;
  const verdictProblem =
    facts && facts.verdict !== "token" ? facts.verdict : undefined;
  // Untracked lookups need a verified on-chain identity before market data.
  const showMarket =
    !verdictProblem && (asset !== undefined || facts?.verdict === "token");
  const symbol = facts?.symbol ?? null;
  return (
    <div className="trade-page">
      <Link href="/" className="back-link">
        <ArrowLeft size={14} />
        Back to Discover
      </Link>
      <div className="token-detail-heading">
        <TokenMark symbol={symbol} address={token.address} size={60} />
        <div>
          <h1>
            {facts?.name ??
              (onchain.isPending ? "Reading token…" : shorten(token.address))}
            {symbol ? <span>{symbol}</span> : null}
          </h1>
          <p>
            <span className="status-label tracked">
              {asset ? (
                <>
                  <Radar size={11} />
                  Tracked on RETRY · External token
                </>
              ) : (
                <>
                  <Info size={11} />
                  Untracked lookup
                </>
              )}
            </span>
            <span>
              {MARKET_NETWORKS[token.chainId]?.name ?? "Unknown"} mainnet ·
              Chain {token.chainId}
            </span>
            {facts?.standard ? (
              <span className="status-label">
                <BadgeCheck size={11} />
                {facts.standard === "b20"
                  ? `B20${facts.b20Variant === "asset" ? " · Asset" : facts.b20Variant === "stablecoin" ? " · Stablecoin" : ""}`
                  : "ERC-20"}
              </span>
            ) : null}
            <CopyAddress address={token.address} />
            <a
              href={explorerTokenUrl(token.chainId, token.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="reference-button"
            >
              BaseScan
              <ArrowUpRight size={11} />
            </a>
          </p>
        </div>
      </div>
      {onchain.isError ? (
        <ErrorNote
          message="Couldn’t read the contract from Base RPC, so the token identity is not verified right now."
          onRetry={() => onchain.refetch()}
        />
      ) : null}
      {asset && facts?.verdict === "token" ? (
        <SnapshotCheck asset={asset} facts={facts} />
      ) : null}
      {verdictProblem ? (
        <Diagnostic verdict={verdictProblem} facts={facts!} />
      ) : showMarket ? (
        <MarketSections token={token} asset={asset} facts={facts} />
      ) : onchain.isPending ? (
        <LoadingSkeleton />
      ) : null}
    </div>
  );
}

function SnapshotCheck({
  asset,
  facts,
}: {
  asset: TrackedAsset;
  facts: OnchainTokenFacts;
}) {
  const v = asset.verification;
  const changed =
    facts.name !== v.name ||
    facts.symbol !== v.symbol ||
    facts.decimals !== v.decimals ||
    facts.totalSupply?.toString() !== v.totalSupplyRaw;
  return changed ? (
    <div className="notice-strip mb-5" role="status">
      On-chain metadata differs from the identity verified on{" "}
      {v.checkedAt.slice(0, 10)} (block {v.blockNumber.toLocaleString("en-US")}
      ). The page shows the current on-chain values.
    </div>
  ) : null;
}

function Diagnostic({
  verdict,
  facts,
}: {
  verdict: Exclude<OnchainTokenFacts["verdict"], "token">;
  facts: OnchainTokenFacts;
}) {
  const copy = {
    "no-code": {
      title: "No contract at this address on Base",
      body: "Base mainnet returns no bytecode and the B20 factory does not know this address. Nothing is traded here, so no market data is shown.",
    },
    "not-erc20": {
      title: "This contract is not an ERC-20 token",
      body: "The contract exists but does not answer name, symbol, decimals or totalSupply. RETRY does not guess a token identity.",
    },
    "wrong-chain": {
      title: "The RPC endpoint is on another network",
      body: `Expected chain ${facts.token.chainId}, got ${facts.rpcChainId}. No data is shown to avoid mixing networks.`,
    },
  }[verdict];
  return (
    <section className="panel diagnostic-panel">
      <EmptyState title={copy.title}>{copy.body}</EmptyState>
    </section>
  );
}

function MarketSections({
  token,
  asset,
  facts,
}: {
  token: TokenRef;
  asset?: TrackedAsset;
  facts?: OnchainTokenFacts;
}) {
  const market = useTokenMarket(token, asset?.primaryPool?.id);
  const data = market.data;
  const primary = data?.selection.primary ?? null;
  const symbol = facts?.symbol ?? asset?.verification.symbol ?? "Token";
  const fdv = computeFdvUsd(
    facts?.totalSupply ?? null,
    facts?.decimals ?? null,
    primary?.priceUsd ?? null,
  );
  const pair = primary ? poolLabel(primary, asset) : null;
  const stats = [
    {
      label: "Price (USD)",
      value: primary?.priceUsd ? usdPrice(primary.priceUsd) : null,
      why: "No eligible pool price",
      change: primary?.priceChangePct.h24 ?? null,
    },
    {
      label: primary
        ? `Price (${primary.pool.quoteToken.symbol})`
        : "Price (quote)",
      value: primary?.priceQuote
        ? quotePrice(primary.priceQuote, primary.pool.quoteToken.symbol)
        : null,
      why: "No quote-asset price",
    },
    {
      label: "Volume 24h · pool",
      value:
        primary?.volumeUsd.h24 != null
          ? usdAmount(primary.volumeUsd.h24)
          : null,
      why: "Volume not reported",
    },
    {
      label: "Liquidity · pool",
      value: primary?.liquidityUsd ? usdAmount(primary.liquidityUsd) : null,
      why: "Liquidity not reported",
    },
    {
      label: "FDV · calculated",
      value: fdv ? usdAmount(fdv) : null,
      why: "Needs on-chain total supply and a pool price",
      title: "On-chain totalSupply × primary-pool USD price",
    },
    {
      label: "Market cap",
      value: null,
      why: "Circulating supply is not verified, so market cap is not shown. FDV is not market cap.",
    },
  ];
  return (
    <>
      {market.isPending ? (
        <div className="market-stats market-stats-loading" aria-busy="true">
          {stats.map((s) => (
            <div className="market-stat" key={s.label}>
              <span>{s.label}</span>
              <strong className="skeleton-text" />
            </div>
          ))}
        </div>
      ) : market.isError && !data ? (
        <ErrorNote
          message={`Market data is unavailable: ${errorMessage(market.error)}`}
          onRetry={() => market.refetch()}
        />
      ) : (
        <>
          <div className="market-stats">
            {stats.map((stat) => (
              <div className="market-stat" key={stat.label} title={stat.title}>
                <span>{stat.label}</span>
                <strong>
                  {stat.value ?? <Unavailable>{stat.why}</Unavailable>}
                </strong>
                {"change" in stat && stat.value ? (
                  <span className="stat-change">
                    <Change value={stat.change ?? null} /> 24h
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          {primary ? (
            <div className="market-changes">
              {(["m5", "h1", "h6", "h24"] as const).map((w) => (
                <span key={w}>
                  {w === "m5"
                    ? "5m"
                    : w === "h1"
                      ? "1h"
                      : w === "h6"
                        ? "6h"
                        : "24h"}{" "}
                  <Change value={primary.priceChangePct[w]} />
                </span>
              ))}
              <span>
                Trades 24h{" "}
                {primary.txns.h24
                  ? `${primary.txns.h24.buys.toLocaleString("en-US")} buys · ${primary.txns.h24.sells.toLocaleString("en-US")} sells`
                  : "—"}
              </span>
              <span>
                Holders <Unavailable>No holder index is integrated</Unavailable>
              </span>
            </div>
          ) : null}
          {data ? (
            <SourceLine
              source={data.source}
              fallback={data.fallbackUsed}
              retrievedAt={data.retrievedAt}
              refreshMs={POOLS_REFRESH_MS}
              refreshFailed={market.isRefetchError}
              detail={
                pair ? `${pair.pair} · ${pair.venue}` : "no eligible pool"
              }
            />
          ) : null}
        </>
      )}
      <div className="terminal-grid">
        <div className="terminal-main">
          <ChartPanel
            token={token}
            symbol={symbol}
            primary={primary}
            pair={pair}
            marketPending={market.isPending}
          />
          <TradesPanel token={token} symbol={symbol} primary={primary} />
          {data ? (
            <PoolsPanel
              selection={data.selection}
              total={data.pools.length}
              asset={asset}
            />
          ) : null}
        </div>
        <aside className="terminal-aside">
          <TradePanel
            symbol={symbol}
            token={token}
            decimals={facts?.decimals ?? null}
          />
          <AboutPanel token={token} asset={asset} facts={facts} />
        </aside>
      </div>
    </>
  );
}

function ChartPanel({
  token,
  symbol,
  primary,
  pair,
  marketPending,
}: {
  token: TokenRef;
  symbol: string;
  primary: PoolMarket | null;
  pair: { pair: string; venue: string } | null;
  marketPending: boolean;
}) {
  const [interval, setInterval] = useState<CandleInterval>("1h");
  const [mode, setMode] = useState<"candles" | "line">("candles");
  const candles = useCandles(token, primary?.pool.id, interval);
  const series = useMemo(
    () =>
      candles.data
        ? chartSeries(
            candles.data.candles,
            INTERVAL_SECONDS[candles.data.interval],
          )
        : null,
    [candles.data],
  );
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <h2>
          {symbol} / USD
          {pair ? (
            <span className="tiny muted ml-2">
              {pair.pair} · {pair.venue}
            </span>
          ) : null}
        </h2>
      </div>
      <div className="chart-toolbar">
        <div role="group" aria-label="Candle interval">
          {INTERVALS.map((i) => (
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
          onClick={() => setMode(mode === "candles" ? "line" : "candles")}
          aria-label={`Show ${mode === "candles" ? "line" : "candles"}`}
        >
          {mode === "candles" ? (
            <CandlestickChart size={13} />
          ) : (
            <ChartNoAxesCombined size={13} />
          )}
          {mode === "candles" ? "Candles" : "Line"}
        </button>
      </div>
      {!primary ? (
        marketPending ? (
          <LoadingSkeleton />
        ) : (
          <EmptyState title="No chart available">
            No pool prices this token against ETH, WETH or USDC with enough
            liquidity, so there is no price history to draw.
          </EmptyState>
        )
      ) : candles.isPending ? (
        <LoadingSkeleton />
      ) : candles.isError && !candles.data ? (
        <ErrorNote
          message={`Price history is unavailable: ${errorMessage(candles.error)}`}
          onRetry={() => candles.refetch()}
        />
      ) : candles.data && series ? (
        <>
          {series.slots.length ? (
            <CandleChart
              series={series}
              interval={candles.data.interval}
              mode={mode}
              pairLabel={pair?.pair ?? symbol}
            />
          ) : (
            <EmptyState title="No candles for this interval">
              The provider has no trades recorded for this pool in this window.
              No prices are drawn where nothing was observed.
            </EmptyState>
          )}
          <SourceLine
            source={candles.data.provenance.source}
            retrievedAt={candles.data.provenance.retrievedAt}
            refreshMs={CANDLE_REFRESH_MS[interval]}
            refreshFailed={candles.isRefetchError}
            detail={`${interval} OHLCV · UTC${series.gaps ? ` · ${series.gaps} interval${series.gaps === 1 ? "" : "s"} without trades left empty` : ""}${series.trimmed ? ` · ${series.trimmed} older candle${series.trimmed === 1 ? "" : "s"} not drawn` : ""}`}
          />
        </>
      ) : null}
    </section>
  );
}

function TradesPanel({
  token,
  symbol,
  primary,
}: {
  token: TokenRef;
  symbol: string;
  primary: PoolMarket | null;
}) {
  const trades = useMarketTrades(token, primary?.pool.id);
  const [limit, setLimit] = useState(25);
  const now = useNow();
  const list = trades.data?.trades ?? [];
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <h2>Market activity</h2>
        <span className="tiny muted">
          All traders · primary pool · not your wallet
        </span>
      </div>
      {!primary ? (
        <EmptyState title="No market activity">
          Trades appear once an eligible pool exists.
        </EmptyState>
      ) : trades.isPending ? (
        <LoadingSkeleton />
      ) : trades.isError && !trades.data ? (
        <ErrorNote
          message={`Trades are unavailable: ${errorMessage(trades.error)}`}
          onRetry={() => trades.refetch()}
        />
      ) : list.length === 0 ? (
        <EmptyState title="No recent trades">
          The provider reports no swaps in this pool in the last 24 hours.
        </EmptyState>
      ) : (
        <>
          <div className="table-scroll">
            <table className="activity-table">
              <caption className="sr-only">
                Swaps in the {symbol} primary pool indexed by GeckoTerminal.
              </caption>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount ({symbol})</th>
                  <th>Price (USD)</th>
                  <th>Value (USD)</th>
                  <th>Trader</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, limit).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <a
                        className={`trade-side ${t.side === "buy" ? "positive" : "negative"}`}
                        href={explorerTxUrl(token.chainId, t.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Transaction ${t.txHash}`}
                      >
                        {t.side === "buy" ? (
                          <ArrowDownLeft size={12} />
                        ) : (
                          <ArrowUpRight size={12} />
                        )}
                        {t.side}
                      </a>
                    </td>
                    <td>{tokenAmount(t.tokenAmount)}</td>
                    <td>{t.priceUsd ? usdPrice(t.priceUsd) : "—"}</td>
                    <td>{t.volumeUsd ? usdAmount(t.volumeUsd) : "—"}</td>
                    <td>
                      {t.trader ? (
                        <a
                          href={explorerAddressUrl(token.chainId, t.trader)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {shorten(t.trader)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td title={new Date(t.time).toISOString()}>
                      {ago(t.time, now)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.length > limit ? (
            <button className="table-more" onClick={() => setLimit(limit + 50)}>
              Show more ({list.length - limit} left)
            </button>
          ) : null}
          {trades.data ? (
            <SourceLine
              source={trades.data.provenance.source}
              retrievedAt={trades.data.provenance.retrievedAt}
              refreshMs={TRADES_REFRESH_MS}
              refreshFailed={trades.isRefetchError}
              detail={`last 24 h, up to 300 swaps${trades.data.hiddenAnomalous ? ` · ${trades.data.hiddenAnomalous} flagged anomalous by the provider hidden` : ""}`}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function PoolsPanel({
  selection,
  total,
  asset,
}: {
  selection: PoolSelection;
  total: number;
  asset?: TrackedAsset;
}) {
  const counts = new Map<ExclusionReason, number>();
  for (const { reason } of selection.excluded)
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  const note = {
    pinned: asset?.primaryPool?.rationale ?? "Configured primary pool.",
    ranked: "Deepest eligible pool by reported liquidity, then 24 h volume.",
    "pinned-missing":
      "The configured primary pool is not listed right now. Showing the deepest eligible pool instead.",
    "pinned-ineligible":
      "The configured primary pool no longer meets the liquidity or activity rules. Showing the deepest eligible pool instead.",
    "none-eligible": "No pool meets the rules, so no price is shown.",
  }[selection.reason];
  return (
    <section className="panel pools-panel">
      <div className="panel-heading">
        <h2>Pools</h2>
        <span className="tiny muted">
          {selection.eligible.length} eligible of {total} listed · never summed
        </span>
      </div>
      <p
        className={`pool-note ${selection.reason.startsWith("pinned-") ? "warning" : ""}`}
      >
        {selection.reason.startsWith("pinned-") ? (
          <ShieldAlert size={13} />
        ) : (
          <Info size={13} />
        )}
        {note}
      </p>
      {selection.eligible.length ? (
        <div className="table-scroll">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Pair</th>
                <th>Venue</th>
                <th>Liquidity</th>
                <th>Volume 24h</th>
                <th>Pool ID</th>
              </tr>
            </thead>
            <tbody>
              {selection.eligible.slice(0, 8).map((m) => {
                const label = poolLabel(m, asset);
                return (
                  <tr key={m.pool.id}>
                    <td>
                      {label.pair}
                      {m.pool.id === selection.primary?.pool.id ? (
                        <span className="primary-badge">Primary</span>
                      ) : null}
                    </td>
                    <td>{label.venue}</td>
                    <td>{m.liquidityUsd ? usdAmount(m.liquidityUsd) : "—"}</td>
                    <td>
                      {m.volumeUsd.h24 != null
                        ? usdAmount(m.volumeUsd.h24)
                        : "—"}
                    </td>
                    <td title={m.pool.id}>{shorten(m.pool.id)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {counts.size ? (
        <p className="tiny muted pool-excluded">
          Excluded:{" "}
          {[...counts.entries()]
            .map(([reason, n]) => `${n} ${EXCLUSION_LABELS[reason]}`)
            .join(" · ")}
          .
        </p>
      ) : null}
    </section>
  );
}

function AboutPanel({
  token,
  asset,
  facts,
}: {
  token: TokenRef;
  asset?: TrackedAsset;
  facts?: OnchainTokenFacts;
}) {
  const supply =
    facts?.totalSupply != null && facts.decimals != null
      ? tokenSupply(rawToAmount(facts.totalSupply, facts.decimals))
      : null;
  return (
    <section className="panel trade-info">
      <h3>About this token</h3>
      <p>
        {asset
          ? "An external token RETRY tracks for market data. It was not created on RETRY, and RETRY does not own it or control its liquidity."
          : "A token looked up by address. RETRY does not track it and has not reviewed it."}
      </p>
      <dl className="detail-list">
        <div>
          <dt>Network</dt>
          <dd>Base mainnet · {token.chainId}</dd>
        </div>
        <div>
          <dt>Standard</dt>
          <dd>
            {facts?.standard === "b20"
              ? `B20 (Base native)${facts.b20Variant === "asset" ? " · Asset" : ""}`
              : facts?.standard === "erc20"
                ? "ERC-20"
                : "—"}
          </dd>
        </div>
        <div>
          <dt>Bytecode</dt>
          <dd>
            {!facts
              ? "—"
              : facts.standard === "b20"
                ? "Precompile (0xef marker)"
                : `${facts.codeBytes.toLocaleString("en-US")} bytes`}
          </dd>
        </div>
        <div>
          <dt>Decimals</dt>
          <dd>{facts?.decimals ?? "—"}</dd>
        </div>
        <div>
          <dt>Total supply</dt>
          <dd>{supply ?? "—"}</dd>
        </div>
        <div>
          <dt>Bonding curve</dt>
          <dd>Not applicable · external token</dd>
        </div>
        <div>
          <dt>RETRY graduation</dt>
          <dd>Not applicable</dd>
        </div>
        <div>
          <dt>Holders</dt>
          <dd>Not indexed</dd>
        </div>
      </dl>
      {facts ? (
        <p className="tiny about-note">
          Identity read from Base RPC {ago(facts.retrievedAt)}.
          {asset ? (
            <>
              {" "}
              First verified at block{" "}
              <a
                href={asset.verification.evidence}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-link"
              >
                {asset.verification.blockNumber.toLocaleString("en-US")}
              </a>
              .
            </>
          ) : null}
        </p>
      ) : null}
      {facts?.standard === "b20" ? (
        <p className="tiny about-note about-warning">
          <ShieldAlert size={12} />
          B20 tokens can give their issuer mint, pause and transfer-policy
          controls. RETRY has not reviewed this token’s roles. This is not a
          safety assessment.
        </p>
      ) : null}
    </section>
  );
}
