import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Clock3, Users } from "lucide-react";
import type { Token } from "@/types/token";
import { age, number, percent, usd } from "@/lib/format";
import { assetPath } from "@/lib/asset-path";
export function TokenAvatar({
  token,
  size = 52,
}: {
  token: Token;
  size?: number;
}) {
  return (
    <Image
      className="token-avatar"
      src={assetPath(token.metadata.image)}
      width={size}
      height={size}
      alt={`${token.metadata.name} artwork`}
      unoptimized
    />
  );
}
export function BondingProgress({
  progress,
  graduated = false,
}: {
  progress: number;
  graduated?: boolean;
}) {
  return (
    <div className={`bonding ${graduated ? "graduated" : ""}`}>
      <div className="bonding-label">
        <span>
          {graduated ? (
            <>
              <BadgeCheck size={12} />
              Graduated
            </>
          ) : (
            "Bonding curve"
          )}
        </span>
        <span>{progress}%</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Bonding curve progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
export function Sparkline({
  positive,
  seed,
}: {
  positive: boolean;
  seed: number;
}) {
  const pts = Array.from(
    { length: 24 },
    (_, i) =>
      `${i * 3},${(30 - (positive ? i * 0.8 : (24 - i) * 0.7) - Math.sin(i * 1.8 + seed) * 5).toFixed(2)}`,
  ).join(" ");
  return (
    <svg
      className={positive ? "sparkline positive" : "sparkline negative"}
      viewBox="0 0 70 36"
      fill="none"
      aria-hidden="true"
    >
      <polyline points={pts} stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
export function TokenCard({ token }: { token: Token }) {
  const { metadata: m, market: v, launch: l } = token;
  return (
    <Link href={`/token/${token.id}`} className="token-card">
      <div className="token-card-top">
        <TokenAvatar token={token} />
        <div className="token-identity">
          <h3>
            {m.name}
            <ArrowUpRight size={14} />
          </h3>
          <div className="token-meta">
            <span>{m.symbol}</span>
            <span className="token-age">
              <Clock3 size={10} />
              {age(l.createdAt)}
            </span>
          </div>
        </div>
        <span className="token-base" title="Base demo token">
          <span className="base-mark" />
        </span>
      </div>
      <p className="token-description">{m.description}</p>
      <div className="token-values">
        <div>
          <span>Market cap</span>
          <strong>{usd(v.marketCap)}</strong>
        </div>
        <div>
          <span>Volume</span>
          <strong>{usd(v.volume24h)}</strong>
        </div>
        <div className="token-change">
          <Sparkline positive={v.change24h >= 0} seed={v.holders} />
          <strong className={v.change24h >= 0 ? "positive" : "negative"}>
            {percent(v.change24h)}
          </strong>
        </div>
      </div>
      <BondingProgress
        progress={l.curve.progress}
        graduated={l.stage === "graduated"}
      />
      <div className="token-card-footer">
        <span>
          <Users size={11} />
          {number(v.holders)}
        </span>
        <span>{token.demoReference}</span>
        <span className="tiny">Demo</span>
      </div>
    </Link>
  );
}
