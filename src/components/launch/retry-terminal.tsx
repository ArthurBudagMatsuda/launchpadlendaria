"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { PoolConfig, VirtualPool } from "@/lib/meteora/sdk";
import { ArrowLeft, Coins } from "lucide-react";
import { CLUSTERS } from "@/config/solana";
import { useOnchainToken } from "@/hooks/use-solana-market";
import {
  POOL_REFRESH_MS,
  useDammPool,
  useExecute,
  useLaunchHistory,
  useMeteora,
  useOffchainMetadata,
  userMessage,
} from "@/hooks/use-retry";
import {
  CopyAddress,
  ErrorNote,
  SourceLine,
} from "@/components/market/primitives";
import { LoadingSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { shorten } from "@/lib/format";
import { feeSchedule, prepareCreatorClaim } from "@/lib/meteora/fees";
import { sol, tokens } from "@/lib/meteora/format";
import { mergeActivity } from "@/lib/meteora/history";
import type { OnchainMetadata } from "@/lib/meteora/metadata";
import type { RetryPool } from "@/lib/meteora/pools";
import type { SolanaAddress } from "@/lib/solana/address";
import { GraduationPanel } from "./graduation-panel";
import {
  ActivityTable,
  LaunchChart,
  type LaunchHistory,
} from "./launch-history";
import {
  ExplorerLink,
  LaunchMark,
  OperationState,
  StatusBadge,
} from "./launch-ui";
import { RetryTradePanel } from "./retry-trade-panel";

// The DAMM v2 SDK is only downloaded for tokens that graduated.
const DammTradePanel = dynamic(
  () => import("./damm-panels").then((m) => m.DammTradePanel),
  { ssr: false, loading: () => <LoadingSkeleton /> },
);
const LpFeesPanel = dynamic(
  () => import("./damm-panels").then((m) => m.LpFeesPanel),
  { ssr: false },
);

const solFigure = (value: string) =>
  `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })} SOL`;

/** Token page for a RETRY launch: everything is read from its DBC pool and mint. */
export function RetryTerminal({
  pool,
  raw,
  config,
  metadata,
  retrievedAt,
}: {
  pool: RetryPool;
  raw: VirtualPool;
  config: PoolConfig;
  metadata: OnchainMetadata | null;
  retrievedAt: number;
}) {
  const offchain = useOffchainMetadata(metadata).data;
  const mint = useOnchainToken({
    cluster: pool.cluster,
    address: pool.baseMint as SolanaAddress,
  }).data;
  const { wallet } = useMeteora();
  const [tab, setTab] = useState<"activity" | "accounts">("activity");
  const symbol = metadata?.symbol ?? "TOKEN";
  const fees = feeSchedule();
  const graduated = pool.status === "graduated";
  const damm = useDammPool(pool);
  const graduatedPool = graduated ? damm.data?.pool : undefined;
  const historyQuery = useLaunchHistory(pool);
  const items = useMemo(
    () => mergeActivity(historyQuery.data?.pages ?? []),
    [historyQuery.data],
  );
  const history: LaunchHistory = {
    items,
    isPending: historyQuery.isPending,
    isError: historyQuery.isError,
    retrievedAt: historyQuery.dataUpdatedAt,
    hasMore: Boolean(historyQuery.hasNextPage),
    loadingOlder: historyQuery.isFetchingNextPage,
    loadOlder: () => void historyQuery.fetchNextPage(),
    refetch: () => void historyQuery.refetch(),
  };
  const stats = graduatedPool
    ? [
        {
          label: "Price",
          value: `${Number(graduatedPool.priceSol).toPrecision(4)} SOL`,
        },
        { label: "FDV", value: solFigure(graduatedPool.fdvSol) },
        { label: "SOL in pool", value: sol(graduatedPool.quoteReserve, 3) },
        { label: "Tokens in pool", value: tokens(graduatedPool.baseReserve) },
        {
          label: "Trades on",
          value: `DAMM v2 · ${graduatedPool.feeBps / 100}% fee`,
        },
        { label: "Supply", value: "1,000,000,000 (fixed)" },
      ]
    : [
        {
          label: "Price",
          value: `${Number(pool.priceSol).toPrecision(4)} SOL`,
        },
        { label: "FDV", value: solFigure(pool.fdvSol) },
        { label: "SOL in curve", value: sol(pool.quoteReserve, 3) },
        { label: "Tokens in curve", value: tokens(pool.baseReserve) },
        { label: "Fees charged", value: sol(pool.totalTradingQuoteFee, 4) },
        { label: "Supply", value: "1,000,000,000 (fixed)" },
      ];
  return (
    <div className="trade-page">
      <Link href="/" className="back-link">
        <ArrowLeft size={14} />
        Back to Discover
      </Link>
      <div className="token-detail-heading">
        <LaunchMark
          address={pool.baseMint}
          symbol={metadata?.symbol ?? null}
          image={offchain?.image}
          size={60}
        />
        <div>
          <h1>
            {metadata?.name ?? shorten(pool.baseMint)}{" "}
            <span className="muted">${symbol}</span>
          </h1>
          <p>
            <StatusBadge status={pool.status} />
            <span>{CLUSTERS[pool.cluster].label}</span>
            <CopyAddress address={pool.baseMint as SolanaAddress} />
            <ExplorerLink
              cluster={pool.cluster}
              kind="address"
              value={pool.baseMint}
            >
              Solana Explorer
            </ExplorerLink>
          </p>
          {offchain?.description ? (
            <p className="token-description">{offchain.description}</p>
          ) : null}
          <p className="token-links">
            {offchain?.website ? (
              <a
                href={offchain.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                Website
              </a>
            ) : null}
            {offchain?.twitter ? (
              <a
                href={offchain.twitter}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                X
              </a>
            ) : null}
            {offchain?.telegram ? (
              <a
                href={offchain.telegram}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                Telegram
              </a>
            ) : null}
          </p>
        </div>
      </div>
      <div className="market-stats">
        {stats.map((item) => (
          <div className="market-stat" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <SourceLine
        source="solana-rpc"
        retrievedAt={graduatedPool ? damm.dataUpdatedAt : retrievedAt}
        refreshMs={POOL_REFRESH_MS}
        refreshFailed={graduated && damm.isError}
        detail={
          graduatedPool
            ? `Meteora DAMM v2 pool state at slot ${graduatedPool.slot.toLocaleString("en-US")}`
            : `Meteora DBC pool state at slot ${pool.slot.toLocaleString("en-US")}`
        }
      />
      <div className="terminal-grid">
        <div className="terminal-main">
          <LaunchChart pool={pool} symbol={symbol} history={history} />
          <section className="panel activity-panel">
            <nav className="portfolio-tabs" aria-label="Token information">
              <button
                className={tab === "activity" ? "active" : ""}
                onClick={() => setTab("activity")}
              >
                Activity
              </button>
              <button
                className={tab === "accounts" ? "active" : ""}
                onClick={() => setTab("accounts")}
              >
                Accounts
              </button>
            </nav>
            {tab === "activity" ? (
              <ActivityTable pool={pool} history={history} />
            ) : (
              <dl className="detail-list accounts-list">
                {[
                  ["DBC pool", pool.address],
                  ["RETRY config", pool.config],
                  ["Creator", pool.creator],
                  ["Base vault", pool.baseVault],
                  ["SOL vault", pool.quoteVault],
                  ["DAMM v2 config", pool.dammV2Config],
                  ...(graduatedPool
                    ? [
                        ["DAMM v2 pool", graduatedPool.address],
                        ["DAMM v2 token vault", graduatedPool.tokenAVault],
                        ["DAMM v2 SOL vault", graduatedPool.tokenBVault],
                      ]
                    : []),
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      <ExplorerLink
                        cluster={pool.cluster}
                        kind="address"
                        value={value}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>
        <aside className="terminal-aside">
          {/* Keyed by account: switching wallets starts a clean form. */}
          {!graduated ? (
            <RetryTradePanel
              key={wallet.address ?? "none"}
              pool={pool}
              raw={raw}
              config={config}
              symbol={symbol}
            />
          ) : damm.data ? (
            <DammTradePanel
              key={wallet.address ?? "none"}
              pool={pool}
              damm={damm.data}
              symbol={symbol}
            />
          ) : damm.isError ? (
            <section className="panel trade-panel">
              <h2>Trade {symbol}</h2>
              <ErrorNote
                message="The DAMM v2 pool could not be read, or it did not pass RETRY's checks. Trading stays off until it does."
                onRetry={() => damm.refetch()}
              />
            </section>
          ) : (
            <LoadingSkeleton />
          )}
          <GraduationPanel pool={pool} config={config} damm={damm.data} />
          {damm.data ? <LpFeesPanel pool={pool} damm={damm.data} /> : null}
          <CreatorFees pool={pool} />
          <section className="panel trade-info">
            <h3>
              <Coins size={14} /> Token facts
            </h3>
            <dl className="detail-list">
              <div>
                <dt>Supply</dt>
                <dd>1,000,000,000 · 9 decimals</dd>
              </div>
              <div>
                <dt>Mint authority</dt>
                <dd>
                  {mint?.verdict === "token"
                    ? mint.mintAuthority
                      ? shorten(mint.mintAuthority)
                      : "None (revoked)"
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Freeze authority</dt>
                <dd>
                  {mint?.verdict === "token"
                    ? mint.freezeAuthority
                      ? shorten(mint.freezeAuthority)
                      : "None"
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Metadata</dt>
                <dd>
                  {metadata
                    ? metadata.isMutable
                      ? "Mutable"
                      : "Immutable"
                    : "Not found"}
                </dd>
              </div>
              <div>
                <dt>Creator allocation</dt>
                <dd>None · creator buys on the curve like anyone</dd>
              </div>
              <div>
                <dt>Trading fee</dt>
                <dd>
                  {fees.tradingPct}% ({fees.protocolPct}% Meteora ·{" "}
                  {fees.creatorPct}% creator · {fees.partnerPct}% RETRY)
                </dd>
              </div>
              <div>
                <dt>Per-wallet limit</dt>
                <dd>None on-chain</dd>
              </div>
            </dl>
            <p className="tiny">
              Read from the mint, its Metaplex account and the DBC pool. A token
              launched on RETRY can still lose all its value; this is not a
              safety rating.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** The creator's unclaimed share of trading fees, claimable only by them. */
function CreatorFees({ pool }: { pool: RetryPool }) {
  const { wallet, context, policy } = useMeteora("claim-fees");
  const { state, run, reset, canSign } = useExecute("claim-fees");
  const [error, setError] = useState<string | null>(null);
  if (wallet.address !== pool.creator) return null;
  async function claim() {
    if (!context) return;
    reset();
    setError(null);
    try {
      const prepared = await prepareCreatorClaim(context, {
        creator: new PublicKey(pool.creator),
        pool: new PublicKey(pool.address),
      });
      await run({
        kind: "claim",
        tx: prepared.tx,
        expect: prepared.expect,
        pool: pool.address,
        mint: pool.baseMint,
        summary: `Claim ${sol(prepared.amount)} creator fees`,
      });
    } catch (cause) {
      setError(userMessage(cause));
    }
  }
  return (
    <section className="panel trade-info">
      <h3>Your creator fees</h3>
      <dl className="detail-list">
        <div>
          <dt>Unclaimed</dt>
          <dd>{sol(pool.creatorQuoteFee, 6)}</dd>
        </div>
      </dl>
      <Button
        variant="secondary"
        onClick={claim}
        disabled={
          !policy?.enabled ||
          !canSign ||
          pool.creatorQuoteFee === 0n ||
          state.phase === "running"
        }
      >
        Claim to my wallet
      </Button>
      {error ? (
        <p className="operation-state error" role="alert">
          {error}
        </p>
      ) : null}
      <OperationState
        state={state}
        cluster={pool.cluster}
        success="Fees claimed."
      />
    </section>
  );
}
