"use client";
import Link from "next/link";
import { ArrowUpRight, Radar } from "lucide-react";
import { tokenHref, type TrackedAsset } from "@/config/featured-assets";
import { useOnchainToken, useTokenMarket } from "@/hooks/use-market";
import { shorten, signedPercent, usdAmount, usdPrice } from "@/lib/format";
import { TokenMark, Unavailable } from "@/components/market/primitives";

/** Discover card for a tracked external token. Every figure is live or "Unavailable". */
export function TrackedTokenCard({ asset }: { asset: TrackedAsset }) {
  const token = { chainId: asset.chainId, address: asset.address };
  const facts = useOnchainToken(token).data;
  const market = useTokenMarket(token, asset.primaryPool?.id);
  const primary = market.data?.selection.primary ?? null;
  const change = primary?.priceChangePct.h24 ?? null;
  const symbol = facts?.symbol ?? asset.verification.symbol;
  const loading = market.isPending;
  const value = (text: string | null, why: string) =>
    loading ? (
      <span className="skeleton-text" />
    ) : (
      (text ?? <Unavailable>{why}</Unavailable>)
    );
  return (
    <Link href={tokenHref(asset)} className="token-card">
      <div className="token-card-top">
        <TokenMark symbol={symbol} address={asset.address} size={46} />
        <div className="token-identity">
          <h3>
            {facts?.name ?? asset.verification.name}
            <ArrowUpRight size={14} />
          </h3>
          <div className="token-meta">
            <span>{symbol}</span>
            <span className="token-age">
              <Radar size={10} />
              Tracked
            </span>
          </div>
        </div>
        <span className="token-base" title="Base mainnet">
          <span className="base-mark" />
        </span>
      </div>
      <p className="token-description">
        External token on Base. Not launched on RETRY.
      </p>
      <div className="token-values">
        <div>
          <span>Price</span>
          <strong>
            {value(
              primary?.priceUsd ? usdPrice(primary.priceUsd) : null,
              "No eligible pool",
            )}
          </strong>
        </div>
        <div>
          <span>Volume 24h</span>
          <strong>
            {value(
              primary?.volumeUsd.h24 != null
                ? usdAmount(primary.volumeUsd.h24)
                : null,
              "Not reported",
            )}
          </strong>
        </div>
        <div className="token-change">
          <span>24h</span>
          <strong
            className={
              change === null ? "muted" : change >= 0 ? "positive" : "negative"
            }
          >
            {loading ? (
              <span className="skeleton-text" />
            ) : (
              signedPercent(change)
            )}
          </strong>
        </div>
      </div>
      <div className="token-liquidity">
        <span>Liquidity · primary pool</span>
        <strong>
          {value(
            primary?.liquidityUsd ? usdAmount(primary.liquidityUsd) : null,
            "Not reported",
          )}
        </strong>
      </div>
      <div className="token-card-footer">
        <span title={asset.address}>{shorten(asset.address)}</span>
        <span>Base · {asset.chainId}</span>
        <span className="tiny">
          {market.isError && !market.data ? "Data unavailable" : "Live market"}
        </span>
      </div>
    </Link>
  );
}
