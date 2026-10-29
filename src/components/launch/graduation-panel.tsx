"use client";
import { PublicKey } from "@solana/web3.js";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExecute, useMeteora, userMessage } from "@/hooks/use-retry";
import { feeSchedule } from "@/lib/meteora/fees";
import { sol } from "@/lib/meteora/format";
import { graduationView, prepareMigration } from "@/lib/meteora/graduation";
import type { RetryPool } from "@/lib/meteora/pools";
import { useState } from "react";
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
 * claimer and are permanently locked by the program.
 */
export function GraduationPanel({ pool }: { pool: RetryPool }) {
  const { wallet, context, policy } = useMeteora();
  const view = graduationView(pool);
  const fees = feeSchedule();
  const { state, run, reset, canSign } = useExecute();
  const [error, setError] = useState<string | null>(null);
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
        <div>
          <dt>Still needed</dt>
          <dd>{sol(view.remainingLamports)}</dd>
        </div>
        <div>
          <dt>Graduates to</dt>
          <dd>Meteora DAMM v2 · {fees.graduatedLpPct}% LP fee</dd>
        </div>
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
          The curve reports a migration, but its DAMM v2 pool was not found.
          RETRY does not guess; check the explorer.
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
        Locked liquidity cannot be withdrawn by anyone, including RETRY. The
        position owners can still claim the LP trading fees it earns.
      </p>
    </section>
  );
}
