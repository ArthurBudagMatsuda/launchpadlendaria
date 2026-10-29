"use client";
// Loaded on demand (next/dynamic) by graduated tokens' pages only: this
// module imports the Meteora DAMM v2 SDK.
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useExecute,
  useLockVerification,
  useMeteora,
  userMessage,
} from "@/hooks/use-retry";
import {
  dammCurrentPoint,
  prepareDammTrade,
  prepareLpFeeClaim,
  quoteDammTrade,
  type DammPool,
} from "@/lib/meteora/damm-v2";
import type { PoolState } from "@/lib/meteora/damm-sdk";
import { sol } from "@/lib/meteora/format";
import type { RetryPool } from "@/lib/meteora/pools";
import { OperationState } from "./launch-ui";
import { TradeForm, type TradeVenue } from "./retry-trade-panel";

type Damm = { pool: DammPool; state: PoolState };

/** Trading after graduation, on the launch's own DAMM v2 pool. */
export function DammTradePanel({
  pool,
  damm,
  symbol,
}: {
  pool: RetryPool;
  damm: Damm;
  symbol: string;
}) {
  const { context } = useMeteora();
  const venue: TradeVenue = {
    feature: "trade-damm",
    address: damm.pool.address,
    slot: damm.pool.slot,
    tradable: damm.pool.enabled,
    notice: damm.pool.enabled
      ? "Graduated: trades go to this token's Meteora DAMM v2 pool. The bonding curve is closed."
      : "Trading is paused on this DAMM v2 pool.",
    feeLabel: `LP fee (${damm.pool.feeBps / 100}%)`,
    feeDetail: (q) =>
      `Meteora ${sol(q.protocolFee, 6)} · LP positions ${sol(q.fee - q.protocolFee, 6)}`,
    quote: async (side, amountIn, slippageBps) =>
      quoteDammTrade({
        side,
        pool: damm.pool,
        state: damm.state,
        amountIn,
        slippageBps,
        currentPoint: await dammCurrentPoint(context!, damm.pool),
      }),
    prepare: (owner, q) =>
      prepareDammTrade(context!, {
        owner,
        launch: new PublicKey(pool.address),
        side: q.side,
        amountIn: q.amountIn,
        slippageBps: q.slippageBps,
        reviewed: q,
      }),
    footnote:
      "The pool is public: anyone can trade it outside RETRY, so its price moves between your quote and your trade.",
  };
  return <TradeForm pool={pool} symbol={symbol} venue={venue} />;
}

/**
 * LP fees for the wallet that holds one of the graduated positions (the
 * creator, or RETRY's fee claimer). Claiming never touches the locked
 * liquidity, which the program does not let anyone withdraw.
 */
export function LpFeesPanel({ pool, damm }: { pool: RetryPool; damm: Damm }) {
  const { wallet, context, policy } = useMeteora("claim-fees");
  const lock = useLockVerification(damm);
  const { state, run, reset, canSign } = useExecute("claim-fees");
  const [error, setError] = useState<string | null>(null);
  const mine = lock.data
    ? [...lock.data.positions, ...lock.data.others].find(
        (p) => wallet.address && p.holder === wallet.address,
      )
    : undefined;
  if (!mine) return null;
  async function claim() {
    if (!context || !wallet.address) return;
    reset();
    setError(null);
    try {
      const prepared = await prepareLpFeeClaim(context, {
        owner: new PublicKey(wallet.address),
        launch: new PublicKey(pool.address),
      });
      await run({
        kind: "claim",
        tx: prepared.tx,
        expect: prepared.expect,
        pool: damm.pool.address,
        mint: pool.baseMint,
        summary: `Claim ${sol(prepared.position.feeBClaimable ?? 0n)} LP fees`,
      });
    } catch (cause) {
      setError(userMessage(cause));
    }
  }
  const claimable = mine.feeBClaimable ?? 0n;
  return (
    <section className="panel trade-info">
      <h3>
        <Coins size={14} /> Your LP fees
      </h3>
      <dl className="detail-list">
        <div>
          <dt>Claimable now</dt>
          <dd>{sol(claimable, 6)}</dd>
        </div>
        <div>
          <dt>Your position</dt>
          <dd>Permanently locked · fees only</dd>
        </div>
      </dl>
      <Button
        variant="secondary"
        onClick={claim}
        disabled={
          !policy?.enabled ||
          !canSign ||
          claimable === 0n ||
          state.phase === "running"
        }
      >
        Claim LP fees
      </Button>
      {error ? (
        <p className="operation-state error" role="alert">
          {error}
        </p>
      ) : null}
      <OperationState
        state={state}
        cluster={pool.cluster}
        success="LP fees claimed. The locked liquidity did not move."
      />
    </section>
  );
}
