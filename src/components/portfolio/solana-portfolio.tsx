"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Copy,
  Layers,
  LockKeyhole,
  Radio,
  Wallet,
} from "lucide-react";
import { ConnectWalletButton } from "@/components/wallet/solana-wallet";
import {
  useSolanaWallet,
  useSolBalance,
} from "@/components/wallet/solana-provider";
import { useApp } from "@/components/providers";
import { EmptyState } from "@/components/ui/feedback";
import { CLUSTERS, explorerUrl } from "@/config/solana";
import { ago, shorten } from "@/lib/format";
import { tokenHref } from "@/config/tracked-mints";
import {
  useDammPools,
  useLpPositions,
  useMeteora,
  useOperations,
  useRetryHoldings,
  useRetryLaunches,
} from "@/hooks/use-retry";
import { sol, tokens } from "@/lib/meteora/format";
import { LaunchCard } from "@/components/launch/launch-card";
import { ExplorerLink, StatusBadge } from "@/components/launch/launch-ui";
import type { SolanaAddress } from "@/lib/solana/address";
import Decimal from "decimal.js";
export function Portfolio() {
  const wallet = useSolanaWallet();
  const balance = useSolBalance();
  const { notify } = useApp();
  const [tab, setTab] = useState("holdings");
  return (
    <div className="portfolio-page">
      <div className="page-heading">
        <div>
          <h1>
            Your corner of Solana<span className="heading-dot">.</span>
          </h1>
          <p>Your tokens, your activity, your next beginning.</p>
        </div>
        <span className="status-label">Portfolio</span>
      </div>
      {wallet.status !== "connected" || !wallet.address ? (
        <section className="panel portfolio-connect">
          <div className="portfolio-art">
            <Wallet size={41} />
          </div>
          <span className="eyebrow">IT STARTS WITH YOUR WALLET</span>
          <h2>A home for your next chapter.</h2>
          <p>
            Connect a Solana wallet to see its public address and real SOL
            balance on the application’s selected cluster.
          </p>
          <ConnectWalletButton align="start" />
          <div className="portfolio-features">
            <span>
              <LockKeyhole size={12} />
              Non-custodial
            </span>
            <span>
              <Layers size={12} />
              Built on Solana
            </span>
            <span>
              <Radio size={12} />
              You sign every transaction
            </span>
          </div>
        </section>
      ) : (
        <>
          <div className="portfolio-overview">
            <section className="panel">
              <h2>Connected wallet</h2>
              <strong>{shorten(wallet.address)}</strong>
              <button
                className="reference-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(wallet.address!);
                    notify("Wallet address copied.");
                  } catch {
                    notify("Clipboard unavailable.", true);
                  }
                }}
              >
                Copy address
                <Copy size={12} />
              </button>
              <p className="address-full mt-3">{wallet.address}</p>
              <p className="mt-3">Connected with {wallet.wallet?.name}</p>
              {wallet.config ? (
                <a
                  className="reference-button mt-3"
                  href={explorerUrl(
                    wallet.config.cluster,
                    "address",
                    wallet.address,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on Solana Explorer
                  <ArrowUpRight size={12} />
                </a>
              ) : null}
            </section>
            <section className="panel">
              <h2>Application cluster</h2>
              <strong>
                {wallet.config
                  ? CLUSTERS[wallet.config.cluster].label
                  : "Configuration unavailable"}
              </strong>
              <p className="mt-3">
                RPC environment selected in RETRY. Your wallet’s own network
                settings are unchanged.
              </p>
              <p>
                {wallet.supportsCluster
                  ? "Wallet advertises support for this cluster."
                  : "Wallet cluster support is not advertised; public identity reads only."}
              </p>
            </section>
            <section className="panel">
              <h2>Native SOL balance · Live RPC</h2>
              <strong>
                {balance.available
                  ? `${balance.display} SOL`
                  : balance.isFetching
                    ? "Loading…"
                    : "Balance unavailable"}
              </strong>
              <p>
                {balance.isError
                  ? "RPC request failed. No estimated balance is shown."
                  : "Lamports read on the selected cluster."}
              </p>
              <button
                className="reference-button mt-3"
                onClick={() => balance.refetch()}
              >
                Refresh balance
              </button>
            </section>
          </div>
          <section className="panel">
            <nav className="portfolio-tabs" aria-label="Portfolio sections">
              {[
                { id: "holdings", title: "SPL holdings" },
                { id: "created", title: "Tokens created" },
                { id: "lp", title: "LP positions" },
                { id: "activity", title: "Activity" },
              ].map((item) => (
                <button
                  key={item.id}
                  className={tab === item.id ? "active" : ""}
                  aria-pressed={tab === item.id}
                  onClick={() => setTab(item.id)}
                >
                  {item.title}
                </button>
              ))}
            </nav>
            {tab === "holdings" ? (
              <Holdings owner={wallet.address} />
            ) : tab === "created" ? (
              <Created owner={wallet.address} />
            ) : tab === "lp" ? (
              <LpPositions owner={wallet.address} />
            ) : (
              <Activity owner={wallet.address} />
            )}
          </section>
        </>
      )}
      {wallet.configError ? (
        <p className="form-error" role="alert">
          {wallet.configError}
        </p>
      ) : null}
    </div>
  );
}

function Holdings({ owner }: { owner: string }) {
  const holdings = useRetryHoldings(owner);
  // A graduated token's price is its DAMM v2 pool's, not its last curve price.
  const graduated = (holdings.data ?? [])
    .map(({ launch }) => launch.pool)
    .filter((pool) => pool.status === "graduated");
  const damm = useDammPools(graduated);
  const dammPrice = new Map(
    damm.flatMap((query) =>
      query.data ? [[query.data.pool.dbcPool, query.data.pool.priceSol]] : [],
    ),
  );
  if (holdings.isError)
    return (
      <EmptyState title="Holdings unavailable">
        Solana RPC did not answer. No balances are estimated.
      </EmptyState>
    );
  if (!holdings.data?.length)
    return (
      <EmptyState
        title={
          holdings.isPending ? "Reading token accounts…" : "No RETRY tokens yet"
        }
        action={
          <Link href="/" className="button button-secondary">
            Explore tokens
            <ArrowUpRight size={14} />
          </Link>
        }
      >
        RETRY tokens held by this wallet on the selected cluster appear here,
        read from its SPL token accounts.
      </EmptyState>
    );
  return (
    <div className="table-scroll">
      <table className="activity-table">
        <caption className="sr-only">RETRY tokens held by this wallet.</caption>
        <thead>
          <tr>
            <th>Token</th>
            <th>Balance</th>
            <th>Value at pool price</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {holdings.data.map(({ launch, amount }) => (
            <tr key={launch.pool.baseMint}>
              <td>
                <Link
                  href={tokenHref({
                    cluster: launch.pool.cluster,
                    address: launch.pool.baseMint as SolanaAddress,
                  })}
                >
                  {launch.metadata?.symbol ?? shorten(launch.pool.baseMint)}
                </Link>
              </td>
              <td>{tokens(amount)}</td>
              <td>
                {launch.pool.status === "graduated" &&
                !dammPrice.has(launch.pool.address)
                  ? "Reading DAMM v2 pool…"
                  : `${new Decimal(amount.toString())
                      .div(1e9)
                      .mul(
                        dammPrice.get(launch.pool.address) ??
                          launch.pool.priceSol,
                      )
                      .toSignificantDigits(4)
                      .toString()} SOL`}
              </td>
              <td>
                <StatusBadge status={launch.pool.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tiny mt-3">
        Value is balance × the pool&apos;s spot price (the curve&apos;s, or the
        DAMM v2 pool&apos;s once graduated), before the 1% fee and the price
        impact a sale would have. RETRY does not show PnL: it does not know your
        entry prices.
      </p>
    </div>
  );
}

function Created({ owner }: { owner: string }) {
  const launches = useRetryLaunches();
  const mine = (launches.data ?? []).filter(
    (launch) => launch.pool.creator === owner,
  );
  if (!mine.length)
    return (
      <EmptyState
        title={
          launches.isPending && launches.fetchStatus !== "idle"
            ? "Reading launches…"
            : "An idea is a good place to start."
        }
        action={
          <Link href="/create" className="button button-secondary">
            Create a token
            <ArrowUpRight size={14} />
          </Link>
        }
      >
        Tokens this wallet launched on RETRY appear here with their unclaimed
        creator fees.
      </EmptyState>
    );
  return (
    <div className="token-grid portfolio-created">
      {mine.map((launch) => (
        <div key={launch.pool.address}>
          <LaunchCard launch={launch} />
          <p className="tiny mt-2">
            Unclaimed creator fees: {sol(launch.pool.creatorQuoteFee, 6)}. Claim
            them on the token page.
            {launch.pool.status === "graduated"
              ? " Your share of the graduated liquidity is permanently locked and earns LP fees; see LP positions."
              : null}
          </p>
        </div>
      ))}
    </div>
  );
}

function LpPositions({ owner }: { owner: string }) {
  const positions = useLpPositions(owner);
  const launches = useRetryLaunches();
  const byPool = new Map(
    (launches.data ?? []).map((launch) => [launch.pool.address, launch]),
  );
  if (positions.isError)
    return (
      <EmptyState title="LP positions unavailable">
        Solana RPC did not answer. Nothing is estimated.
      </EmptyState>
    );
  if (!positions.data?.length)
    return (
      <EmptyState
        title={
          positions.isPending && positions.fetchStatus !== "idle"
            ? "Reading positions…"
            : "No LP positions"
        }
      >
        When a token this wallet created graduates, its share of the DAMM v2
        liquidity is a position NFT in this wallet, permanently locked. It
        appears here with the LP fees it can claim.
      </EmptyState>
    );
  return (
    <div className="table-scroll">
      <table className="activity-table">
        <caption className="sr-only">
          This wallet&apos;s LP positions in graduated RETRY pools.
        </caption>
        <thead>
          <tr>
            <th>Token</th>
            <th>Share of pool</th>
            <th>Locked</th>
            <th>Claimable LP fees</th>
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          {positions.data.map((position) => {
            const launch = byPool.get(position.dbcPool);
            return (
              <tr key={position.position}>
                <td>
                  {launch ? (
                    <Link
                      href={tokenHref({
                        cluster: launch.pool.cluster,
                        address: launch.pool.baseMint as SolanaAddress,
                      })}
                    >
                      {launch.metadata?.symbol ?? shorten(launch.pool.baseMint)}
                    </Link>
                  ) : (
                    shorten(position.dbcPool)
                  )}
                </td>
                <td>{position.sharePct}%</td>
                <td>
                  {position.unlockedLiquidity <= 1n &&
                  position.vestedLiquidity === 0n
                    ? "Permanently"
                    : "Partly"}
                </td>
                <td>{sol(position.feeBClaimable, 6)}</td>
                <td>
                  {launch ? (
                    <ExplorerLink
                      cluster={launch.pool.cluster}
                      kind="address"
                      value={position.position}
                    />
                  ) : (
                    shorten(position.position)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="tiny mt-3">
        Read from this wallet&apos;s position NFTs and the DAMM v2 positions
        they point to. The locked liquidity cannot be withdrawn; claim the fees
        on the token page.
      </p>
    </div>
  );
}

function Activity({ owner }: { owner: string }) {
  const { context } = useMeteora();
  const { operations } = useOperations();
  const mine = operations.filter(
    (op) => op.owner === owner && op.cluster === context?.cluster,
  );
  if (!mine.length)
    return (
      <EmptyState title="A fresh page in your story.">
        Launches, trades and claims you send from this browser appear here, with
        their confirmation status read from Solana.
      </EmptyState>
    );
  return (
    <div className="table-scroll">
      <table className="activity-table">
        <caption className="sr-only">
          Transactions sent from this browser.
        </caption>
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>Status</th>
            <th>Transaction</th>
          </tr>
        </thead>
        <tbody>
          {mine.map((op) => (
            <tr key={op.signature}>
              <td>{ago(op.createdAt)}</td>
              <td>{op.summary}</td>
              <td
                className={
                  op.status === "confirmed"
                    ? "positive"
                    : op.status === "sent"
                      ? ""
                      : "negative"
                }
              >
                {op.status === "sent" ? "waiting" : op.status}
              </td>
              <td>
                <ExplorerLink
                  cluster={op.cluster}
                  kind="tx"
                  value={op.signature}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tiny mt-3">
        Kept in this browser only. Other devices and wallets&apos; history are
        on the explorer.
      </p>
    </div>
  );
}
