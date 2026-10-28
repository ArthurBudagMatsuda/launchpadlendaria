"use client";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { explorerUrl, type SolanaCluster } from "@/config/solana";
import { POLICY_MESSAGES, type ExecutionPolicy } from "@/config/retry-protocol";
import { TokenMark } from "@/components/market/primitives";
import { isTrustedUrl } from "@/lib/meteora/metadata";
import type { LaunchStatus } from "@/lib/meteora/pools";
import type { ExecutionState } from "@/hooks/use-retry";
import { shorten } from "@/lib/format";
import type { SolanaAddress } from "@/lib/solana/address";

/** Token artwork from RETRY's metadata host only; a monogram otherwise. */
export function LaunchMark({
  address,
  symbol,
  image,
  size = 46,
}: {
  address: string;
  symbol: string | null;
  image?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!image || failed || !isTrustedUrl(image))
    return (
      <TokenMark
        address={address as SolanaAddress}
        symbol={symbol}
        size={size}
      />
    );
  return (
    <span
      className="token-mark has-logo"
      style={{ "--mark-size": `${size}px` } as React.CSSProperties}
    >
      <Image
        src={image}
        alt=""
        width={size}
        height={size}
        unoptimized
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export const STATUS_LABELS: Record<LaunchStatus, string> = {
  active: "On the curve",
  "near-graduation": "Graduating soon",
  "graduation-ready": "Ready to graduate",
  migrating: "Graduating",
  graduated: "Graduated",
  "needs-attention": "Check status",
};

export function StatusBadge({ status }: { status: LaunchStatus }) {
  return (
    <span className={`status-label launch-status ${status}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Progress toward the SOL the curve needs to graduate, from pool state. */
export function CurveProgress({ bps, label }: { bps: number; label?: string }) {
  const pct = Math.min(100, bps / 100);
  return (
    <div className="curve-progress">
      <div className="curve-progress-row">
        <span>{label ?? "Bonding curve"}</span>
        <strong>{pct.toFixed(pct >= 10 ? 1 : 2)}%</strong>
      </div>
      <div
        className="curve-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(pct.toFixed(2))}
        aria-label="Bonding curve progress"
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Why execution is off on this cluster, in the user's terms. */
export function PolicyNotice({ policy }: { policy: ExecutionPolicy | null }) {
  if (!policy || policy.enabled) return null;
  return (
    <p className="notice-strip launch-locked">
      <LockKeyhole size={15} />
      {POLICY_MESSAGES[policy.reason]}
    </p>
  );
}

const STAGES = {
  simulating: "Simulating on Solana…",
  signing: "Approve in your wallet…",
  sending: "Sending…",
  confirming: "Waiting for confirmation…",
} as const;

export function ExplorerLink({
  cluster,
  kind,
  value,
  children,
}: {
  cluster: SolanaCluster;
  kind: "address" | "tx";
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      className="reference-button"
      href={explorerUrl(cluster, kind, value)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children ?? shorten(value)}
      <ArrowUpRight size={11} />
    </a>
  );
}

/** The live state of one transaction: stage, then the signature or the error. */
export function OperationState({
  state,
  cluster,
  success,
}: {
  state: ExecutionState;
  cluster: SolanaCluster;
  success: string;
}) {
  if (state.phase === "idle") return null;
  if (state.phase === "running")
    return (
      <p className="operation-state running" role="status">
        <LoaderCircle size={14} className="spin" />
        {STAGES[state.stage]}
      </p>
    );
  if (state.phase === "done")
    return (
      <p className="operation-state done" role="status">
        <CircleCheck size={14} />
        {state.status === "confirmed"
          ? success
          : "Sent. The network has not confirmed it yet; this page checks again on reload."}
        <ExplorerLink cluster={cluster} kind="tx" value={state.signature}>
          View transaction
        </ExplorerLink>
      </p>
    );
  return (
    <p className="operation-state error" role="alert">
      <CircleAlert size={14} />
      {state.message}
      {state.signature ? (
        <ExplorerLink cluster={cluster} kind="tx" value={state.signature}>
          View transaction
        </ExplorerLink>
      ) : null}
    </p>
  );
}
