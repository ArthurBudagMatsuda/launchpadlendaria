"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getAddress, isAddress } from "viem";
import { findTrackedByAddress, tokenHref } from "@/config/featured-assets";
import { MARKET_CHAIN_ID } from "@/lib/market/networks";
import { EmptyState } from "@/components/ui/feedback";
import { TokenTerminal } from "./token-terminal";

/** Any Base contract by address. Tracked tokens link to their own page. */
export function TokenLookup() {
  const raw = (useSearchParams().get("address") ?? "").trim();
  if (!isAddress(raw, { strict: false }))
    return (
      <EmptyState
        title="Enter a Base contract address"
        action={
          <Link href="/" className="button button-primary">
            Back to Discover
          </Link>
        }
      >
        Open this page with ?address=0x… or search a contract address from
        Discover. Tokens are identified by address, never by ticker.
      </EmptyState>
    );
  const address = getAddress(raw);
  const tracked = findTrackedByAddress(MARKET_CHAIN_ID, address);
  return (
    <>
      {tracked ? (
        <div className="notice-strip mt-5">
          RETRY tracks this token.{" "}
          <Link href={tokenHref(tracked)} className="inline-link">
            Open its page
          </Link>
          .
        </div>
      ) : null}
      <TokenTerminal
        key={address}
        token={{ chainId: MARKET_CHAIN_ID, address }}
        asset={tracked}
      />
    </>
  );
}
