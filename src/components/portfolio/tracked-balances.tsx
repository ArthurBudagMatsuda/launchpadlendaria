"use client";
import Link from "next/link";
import type { Address } from "viem";
import { ArrowUpRight } from "lucide-react";
import {
  TRACKED_ASSETS,
  tokenHref,
  type TrackedAsset,
} from "@/config/featured-assets";
import {
  useOnchainToken,
  useTokenBalance,
  useTokenMarket,
} from "@/hooks/use-market";
import { tokenAmount as rawToAmount, valueUsd } from "@/lib/market/metrics";
import { tokenAmount, usdAmount } from "@/lib/format";
import { TokenMark } from "@/components/market/primitives";

/**
 * The connected wallet's balance of each tracked token, read with balanceOf on
 * the token's own chain (Base mainnet), whatever network the wallet is on.
 * The USD value is derived from the primary-pool price and labeled as such.
 * No cost basis is known, so no profit or loss is shown.
 */
export function TrackedBalances({ owner }: { owner: Address }) {
  const active = TRACKED_ASSETS.filter((asset) => asset.status === "active");
  return (
    <div className="tracked-balances">
      {active.map((asset) => (
        <BalanceRow key={asset.slug} asset={asset} owner={owner} />
      ))}
      <p className="tiny muted">
        Balances are read from Base mainnet RPC. Other tokens in your wallet are
        not indexed and are not shown.
      </p>
    </div>
  );
}

function BalanceRow({ asset, owner }: { asset: TrackedAsset; owner: Address }) {
  const token = { chainId: asset.chainId, address: asset.address };
  const facts = useOnchainToken(token).data;
  const balance = useTokenBalance(token, owner);
  const market = useTokenMarket(token, asset.primaryPool?.id);
  const symbol = facts?.symbol ?? asset.verification.symbol;
  const amount =
    balance.data !== undefined && facts?.decimals != null
      ? rawToAmount(balance.data, facts.decimals)
      : null;
  const value = amount
    ? valueUsd(amount, market.data?.selection.primary?.priceUsd ?? null)
    : null;
  return (
    <Link href={tokenHref(asset)} className="balance-row">
      <TokenMark symbol={symbol} address={asset.address} size={36} />
      <div>
        <strong>{facts?.name ?? asset.verification.name}</strong>
        <span>{symbol} · Base mainnet · tracked</span>
      </div>
      <div className="balance-amount">
        <strong>
          {balance.isPending
            ? "Reading…"
            : balance.isError || amount === null
              ? "Unavailable"
              : `${tokenAmount(amount)} ${symbol}`}
        </strong>
        <span>
          {value
            ? `≈ ${usdAmount(value)} at the pool price`
            : balance.isError
              ? "RPC read failed; no balance is assumed"
              : "Value not available"}
        </span>
      </div>
      <ArrowUpRight size={14} />
    </Link>
  );
}
