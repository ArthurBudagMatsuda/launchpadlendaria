"use client";
import Link from "next/link";
import { ArrowUpRight, CircleAlert, Sprout } from "lucide-react";
import { tokenHref } from "@/config/tracked-mints";
import { useOffchainMetadata, type RetryLaunch } from "@/hooks/use-retry";
import { ago, shorten } from "@/lib/format";
import type { SolanaAddress } from "@/lib/solana/address";
import { sol } from "@/lib/meteora/format";
import type { NamingFlag } from "@/lib/meteora/naming";
import { CurveProgress, LaunchMark, StatusBadge } from "./launch-ui";

/**
 * Discover card for a RETRY launch. Every figure is read from its DBC pool;
 * a graduated token's curve figures are its last ones, labelled as such
 * (its live price is on its page, read from the DAMM v2 pool).
 */
export function LaunchCard({
  launch,
  naming,
}: {
  launch: RetryLaunch;
  naming?: NamingFlag;
}) {
  const { pool, metadata } = launch;
  const offchain = useOffchainMetadata(metadata).data;
  const symbol = metadata?.symbol ?? null;
  const created = Number(pool.activationPoint) * 1000;
  const graduated = pool.status === "graduated";
  return (
    <Link
      href={tokenHref({
        cluster: pool.cluster,
        address: pool.baseMint as SolanaAddress,
      })}
      className="token-card launch-card"
    >
      <div className="token-card-top">
        <LaunchMark
          address={pool.baseMint}
          symbol={symbol}
          image={offchain?.image}
        />
        <div className="token-identity">
          <h3>
            {metadata?.name ?? shorten(pool.baseMint)}
            <ArrowUpRight size={14} />
          </h3>
          <div className="token-meta">
            <span>{symbol ?? "Unnamed"}</span>
            <span className="token-age">
              <Sprout size={10} />
              {created ? ago(created) : "RETRY launch"}
            </span>
          </div>
        </div>
        <StatusBadge status={pool.status} />
      </div>
      <p className="token-description">
        {offchain?.description ??
          "Launched on RETRY. Description not available."}
      </p>
      <div className="token-values">
        <div>
          <span>{graduated ? "Price at graduation" : "Price"}</span>
          <strong>{Number(pool.priceSol).toPrecision(3)} SOL</strong>
        </div>
        <div>
          <span>{graduated ? "FDV at graduation" : "FDV"}</span>
          <strong>
            {Number(pool.fdvSol).toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}{" "}
            SOL
          </strong>
        </div>
        <div>
          <span>{graduated ? "Trades on" : "In curve"}</span>
          <strong>{graduated ? "DAMM v2" : sol(pool.quoteReserve, 2)}</strong>
        </div>
      </div>
      {naming && (naming.overLimit || naming.sameTicker > 1) ? (
        <p className={`launch-naming${naming.overLimit ? " over-limit" : ""}`}>
          <CircleAlert size={10} />
          {naming.overLimit
            ? "Launched past RETRY's naming limit. Check the mint."
            : `${naming.sameTicker} RETRY launches use $${symbol}. Check the mint.`}
        </p>
      ) : null}
      <CurveProgress bps={pool.progressBps} label="Graduation progress" />
      <div className="token-card-footer">
        <span title={pool.baseMint}>{shorten(pool.baseMint)}</span>
        <span>Solana · {pool.cluster}</span>
        <span className="tiny">
          {graduated ? "Meteora DAMM v2" : "Meteora DBC"}
        </span>
      </div>
    </Link>
  );
}
