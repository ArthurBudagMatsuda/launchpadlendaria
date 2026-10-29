"use client";
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { CircleAlert, GraduationCap, ShieldCheck } from "lucide-react";
import type { PoolConfig } from "@/lib/meteora/sdk";
import { Button } from "@/components/ui/button";
import {
  useExecute,
  useLockVerification,
  useMeteora,
  userMessage,
} from "@/hooks/use-retry";
import { shorten } from "@/lib/format";
import type { DammPool } from "@/lib/meteora/damm-v2";
import type { PoolState } from "@/lib/meteora/damm-sdk";
import { feeSchedule } from "@/lib/meteora/fees";
import { sol } from "@/lib/meteora/format";
import {
  graduationPriceGap,
  graduationView,
  prepareMigration,
} from "@/lib/meteora/graduation";
import type { RetryPool } from "@/lib/meteora/pools";
import {
  CurveProgress,
  ExplorerLink,
  OperationState,
  StatusBadge,
} from "./launch-ui";

/**
 * Graduation status from pool state, and the manual migration Devnet needs
 * (Meteora's keeper only runs on Mainnet). Anyone can submit it: the payer
 * covers rent and fees, the LP positions go to the creator and RETRY's fee
 * claimer and are permanently locked by the program. Once graduated, the
 * lock is proven from the positions' state, not asserted.
 */
export function GraduationPanel({
  pool,
  config,
  damm,
}: {
  pool: RetryPool;
  config: PoolConfig;
  damm?: { pool: DammPool; state: PoolState };
}) {
  const { wallet, context, policy } = useMeteora("graduate");
  const view = graduationView(pool);
  const fees = feeSchedule();
  const { state, run, reset, canSign } = useExecute("graduate");
  const [error, setError] = useState<string | null>(null);
  const lock = useLockVerification(damm);
  // The DAMM v2 pool opens at the config's migration price.
  const opening = graduationPriceGap(
    pool.sqrtPrice,
    BigInt(config.migrationSqrtPrice.toString()),
  );
  const curveDone = pool.quoteReserve >= pool.migrationQuoteThreshold;
  async function migrate() {
    if (!context || !wallet.address) return;
    reset();
    setError(null);
    try {
      const prepared = await prepareMigration(context, {
        payer: new PublicKey(wallet.address),
        pool: new PublicKey(pool.address),
      });
      await run({
        kind: "migrate",
        tx: prepared.tx,
        expect: prepared.expect,
        extraSigners: prepared.signers,
        pool: pool.address,
        mint: pool.baseMint,
        summary: "Graduate to Meteora DAMM v2",
      });
    } catch (cause) {
      setError(userMessage(cause));
    }
  }
  // Who holds which position, from the DBC accounts: the pool's creator and
  // the config's fee claimer (RETRY).
  const holders = new Map([
    [pool.creator, "Creator"],
    [config.feeClaimer.toBase58(), "RETRY"],
  ]);
  return (
    <section className="panel trade-info graduation-panel">
      <h3>
        <GraduationCap size={14} /> Graduation
      </h3>
      <StatusBadge status={pool.status} />
      <CurveProgress bps={view.progressBps} />
      <dl className="detail-list">
        <div>
          <dt>SOL in curve</dt>
          <dd>
            {sol(pool.quoteReserve)} / {sol(view.thresholdLamports, 0)}
          </dd>
        </div>
        {pool.isMigrated ? null : (
          <div>
            <dt>Still needed</dt>
            <dd>{sol(view.remainingLamports)}</dd>
          </div>
        )}
        <div>
          <dt>Graduates to</dt>
          <dd>Meteora DAMM v2 · {fees.graduatedLpPct}% LP fee</dd>
        </div>
        <div>
          <dt>{pool.isMigrated ? "Opened at" : "Opens at"}</dt>
          <dd>{opening.dammPriceSol} SOL per token</dd>
        </div>
        {curveDone ? (
          <div>
            <dt>Curve ended at</dt>
            <dd>
              {opening.curvePriceSol} SOL (
              {Number(opening.gapPct) >= 0 ? "+" : ""}
              {opening.gapPct}% to DAMM v2)
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Graduated liquidity</dt>
          <dd>
            Locked forever ({view.lockedLiquidity.creator}% creator ·{" "}
            {view.lockedLiquidity.partner}% RETRY)
          </dd>
        </div>
        <div>
          <dt>Migration</dt>
          <dd>
            {view.keeper === "manual"
              ? "Manual on Devnet (anyone can submit)"
              : "Meteora keeper"}
          </dd>
        </div>
        {view.dammV2Pool ? (
          <div>
            <dt>DAMM v2 pool</dt>
            <dd>
              <ExplorerLink
                cluster={pool.cluster}
                kind="address"
                value={view.dammV2Pool}
              />
            </dd>
          </div>
        ) : null}
      </dl>
      {pool.status === "needs-attention" ? (
        <p className="notice-strip">
          <CircleAlert size={14} /> The curve reports a migration, but its DAMM
          v2 pool was not found. RETRY does not guess; check the explorer.
        </p>
      ) : null}
      {pool.status === "migrating" ? (
        <p className="notice-strip">
          The curve is complete and its migration is in progress on-chain.
        </p>
      ) : null}
      {lock.data ? (
        <div className="lock-proof">
          <p className={lock.data.verified ? "positive" : "negative"}>
            {lock.data.verified ? (
              <ShieldCheck size={14} />
            ) : (
              <CircleAlert size={14} />
            )}{" "}
            {lock.data.verified
              ? "Lock verified on-chain"
              : "Lock check did not pass"}
          </p>
          <dl className="detail-list">
            <div>
              <dt>Permanently locked</dt>
              <dd>{lock.data.lockedPct}% of the pool&apos;s liquidity</dd>
            </div>
            <div>
              <dt>Withdrawable</dt>
              <dd>
                {lock.data.unlocked.toString()} unit
                {lock.data.unlocked === 1n ? "" : "s"} (rounding) · vesting{" "}
                {lock.data.vested.toString()}
              </dd>
            </div>
            {lock.data.positions.map((position) => (
              <div key={position.position}>
                <dt>
                  {(position.holder && holders.get(position.holder)) ??
                    "Position"}{" "}
                  position
                </dt>
                <dd>
                  <ExplorerLink
                    cluster={pool.cluster}
                    kind="address"
                    value={position.position}
                  >
                    {shorten(position.position)}
                  </ExplorerLink>
                </dd>
              </div>
            ))}
            {lock.data.others.length ? (
              <div>
                <dt>Other LP positions</dt>
                <dd>{lock.data.others.length} opened later by other wallets</dd>
              </div>
            ) : null}
          </dl>
          {!lock.data.verified ? (
            <p className="notice-strip">
              The positions on-chain do not match a permanent lock of the
              graduated liquidity. Treat this pool with caution and check the
              positions on the explorer.
            </p>
          ) : null}
        </div>
      ) : damm && lock.isError ? (
        <p className="tiny">
          The lock could not be read from Solana RPC right now.
        </p>
      ) : null}
      {view.canMigrate && view.keeper === "manual" ? (
        <>
          <p className="tiny">
            The curve is complete. Submitting the migration costs you only rent
            and network fees (simulated before signing); the liquidity is not
            yours and stays locked.
          </p>
          <Button
            onClick={migrate}
            disabled={!policy?.enabled || !canSign || state.phase === "running"}
          >
            <GraduationCap size={14} />
            Graduate to DAMM v2
          </Button>
        </>
      ) : null}
      {error ? (
        <p className="operation-state error" role="alert">
          {error}
        </p>
      ) : null}
      <OperationState
        state={state}
        cluster={pool.cluster}
        success="Graduated. The DAMM v2 pool is live."
      />
      <p className="tiny">
        Locked liquidity cannot be withdrawn by anyone, including RETRY: the
        DAMM v2 program refuses it, and this panel reads that from the positions
        themselves. The position holders can still claim the LP trading fees it
        earns.
      </p>
    </section>
  );
}
