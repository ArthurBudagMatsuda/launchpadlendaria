"use client";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Radar } from "lucide-react";
import { tokenHref, type TrackedAsset } from "@/config/featured-assets";
import {
  POOLS_REFRESH_MS,
  useOnchainToken,
  useTokenMarket,
} from "@/hooks/use-market";
import { errorMessage } from "@/lib/market/errors";
import { computeFdvUsd } from "@/lib/market/metrics";
import { signedPercent, usdAmount, usdPrice } from "@/lib/format";
import { ErrorNote, SourceLine, TokenMark, Unavailable } from "./primitives";
import { poolLabel } from "./pool-label";

/** Discover's featured market: one verified token, real figures only. */
export function FeaturedToken({ asset }: { asset: TrackedAsset }) {
  const token = { chainId: asset.chainId, address: asset.address };
  const onchain = useOnchainToken(token);
  const facts = onchain.data;
  const market = useTokenMarket(token, asset.primaryPool?.id);
  const data = market.data;
  const primary = data?.selection.primary ?? null;
  const symbol = facts?.symbol ?? asset.verification.symbol;
  const change = primary?.priceChangePct.h24 ?? null;
  const fdv = computeFdvUsd(
    facts?.totalSupply ?? null,
    facts?.decimals ?? null,
    primary?.priceUsd ?? null,
  );
  const loading = market.isPending;
  const figure = (text: string | null, why: string) =>
    loading ? (
      <span className="skeleton-text" />
    ) : (
      (text ?? <Unavailable>{why}</Unavailable>)
    );
  return (
    <section className="featured-section" aria-labelledby="featured-title">
      <div className="trending-heading">
        <Radar size={15} />
        <strong id="featured-title">Featured token</strong>
        <span>Tracked on RETRY · not a RETRY launch</span>
      </div>
      <div className="featured-token">
        <div className="featured-identity">
          <TokenMark symbol={symbol} address={asset.address} size={48} />
          <div>
            <h2>
              {facts?.name ?? asset.verification.name}
              <span>{symbol}</span>
            </h2>
            <p>
              <span className="base-mark" />
              Base mainnet
              {facts?.standard === "b20" ? (
                <span className="status-label">
                  <BadgeCheck size={11} />
                  B20
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="featured-price">
          <span>Price</span>
          <strong>
            {figure(
              primary?.priceUsd ? usdPrice(primary.priceUsd) : null,
              "No eligible pool",
            )}
          </strong>
          {!loading && primary ? (
            <span
              className={
                change === null
                  ? "muted"
                  : change >= 0
                    ? "positive"
                    : "negative"
              }
            >
              {signedPercent(change)} 24h
            </span>
          ) : null}
        </div>
        <dl className="featured-stats">
          <div>
            <dt>Volume 24h</dt>
            <dd>
              {figure(
                primary?.volumeUsd.h24 != null
                  ? usdAmount(primary.volumeUsd.h24)
                  : null,
                "Not reported",
              )}
            </dd>
          </div>
          <div>
            <dt>Liquidity</dt>
            <dd>
              {figure(
                primary?.liquidityUsd ? usdAmount(primary.liquidityUsd) : null,
                "Not reported",
              )}
            </dd>
          </div>
          <div>
            <dt title="On-chain total supply × pool price">FDV</dt>
            <dd>
              {figure(fdv ? usdAmount(fdv) : null, "Needs supply and price")}
            </dd>
          </div>
          <div>
            <dt>Market cap</dt>
            <dd>
              <Unavailable>Circulating supply is not verified</Unavailable>
            </dd>
          </div>
        </dl>
        <Link
          href={tokenHref(asset)}
          className="button button-primary featured-cta"
        >
          Open market
          <ArrowRight size={15} />
        </Link>
      </div>
      {market.isError && !data ? (
        <ErrorNote
          message={`Market data is unavailable: ${errorMessage(market.error)}`}
          onRetry={() => market.refetch()}
        />
      ) : data ? (
        <SourceLine
          source={data.source}
          fallback={data.fallbackUsed}
          retrievedAt={data.retrievedAt}
          refreshMs={POOLS_REFRESH_MS}
          refreshFailed={market.isRefetchError}
          detail={
            primary
              ? `${poolLabel(primary, asset).pair} · ${poolLabel(primary, asset).venue} pool`
              : "no eligible pool"
          }
        />
      ) : null}
    </section>
  );
}
