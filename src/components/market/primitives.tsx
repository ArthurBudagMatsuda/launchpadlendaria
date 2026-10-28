"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { CircleAlert, Copy, Database } from "lucide-react";
import type { Address } from "viem";
import { useApp } from "@/components/providers";
import { freshness } from "@/lib/market/metrics";
import type { DataSourceId } from "@/lib/market/types";
import { ago, utcTime } from "@/lib/format";

export const SOURCE_NAMES: Record<DataSourceId, string> = {
  geckoterminal: "GeckoTerminal",
  dexscreener: "DEX Screener",
  "base-rpc": "Base RPC",
};

/**
 * Placeholder artwork built from the verified symbol. External token logos
 * are not loaded: their provenance is unverified and fetching them would
 * leak visitors' IPs to third parties.
 */
export function TokenMark({
  symbol,
  address,
  size = 52,
}: {
  symbol: string | null;
  address: Address;
  size?: number;
}) {
  const hue = parseInt(address.slice(2, 8), 16) % 360;
  const letters = (symbol ?? "").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2);
  return (
    <span
      className="token-mark"
      aria-hidden="true"
      style={
        {
          "--mark-size": `${size}px`,
          background: `linear-gradient(135deg, hsl(${hue} 45% 32%), hsl(${(hue + 40) % 360} 40% 18%))`,
        } as CSSProperties
      }
    >
      {letters ? letters.toUpperCase() : "?"}
    </span>
  );
}

/** Re-renders every 15 s so "updated 40s ago" and staleness stay current. */
export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Source, update time and freshness for a block of market figures. Data from
 * a failed refresh stays visible only with "Stale" and its own timestamp.
 */
export function SourceLine({
  source,
  retrievedAt,
  refreshMs,
  refreshFailed,
  detail,
  fallback,
}: {
  source: DataSourceId;
  retrievedAt: number;
  refreshMs: number;
  refreshFailed?: boolean;
  detail?: string;
  fallback?: boolean;
}) {
  const now = useNow();
  const state = refreshFailed
    ? "stale"
    : freshness(retrievedAt, refreshMs, now);
  return (
    <p className="source-line" data-freshness={state}>
      <Database size={11} />
      <span>
        {SOURCE_NAMES[source]}
        {fallback ? " (fallback)" : ""}
        {detail ? ` · ${detail}` : ""}
      </span>
      <span title={new Date(retrievedAt).toISOString()}>
        Updated {utcTime(retrievedAt)} · {ago(retrievedAt, now)}
      </span>
      <span className={`freshness ${state}`}>
        {state === "live"
          ? "Live"
          : refreshFailed
            ? "Stale · refresh failed"
            : "Stale"}
      </span>
    </p>
  );
}

export function Unavailable({ children }: { children: string }) {
  return (
    <span className="unavailable" title={children}>
      Unavailable
    </span>
  );
}

export function ErrorNote({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="market-error" role="status">
      <CircleAlert size={15} />
      <p>{message}</p>
      {onRetry ? (
        <button className="button button-secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function CopyAddress({ address }: { address: Address }) {
  const { notify } = useApp();
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="reference-button"
      title={address}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(address);
          setCopied(true);
          notify("Contract address copied.");
          setTimeout(() => setCopied(false), 2500);
        } catch {
          notify("Clipboard unavailable. Copy the address manually.", true);
        }
      }}
    >
      {`${address.slice(0, 6)}…${address.slice(-4)}`}
      <Copy size={11} />
      {copied ? "Copied" : ""}
    </button>
  );
}
