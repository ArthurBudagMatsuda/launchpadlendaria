import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findTrackedAsset, TRACKED_ASSETS } from "@/config/featured-assets";
import { TokenTerminal } from "@/components/market/token-terminal";
// Tracked tokens come from one config, so their pages are generated at build
// time (GitHub Pages is static). Unknown pairs return a real 404; any other
// Base address can still be inspected on /token/?address=…
export const dynamicParams = false;
export function generateStaticParams() {
  return TRACKED_ASSETS.map((asset) => ({
    chain: asset.chainSlug,
    address: asset.slug,
  }));
}
type Params = Promise<{ chain: string; address: string }>;
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { chain, address } = await params;
  const asset = findTrackedAsset(chain, address);
  return {
    title: asset
      ? `${asset.verification.symbol} on Base — Tracked token`
      : "Token not found",
  };
}
export default async function TrackedTokenPage({ params }: { params: Params }) {
  const { chain, address } = await params;
  const asset = findTrackedAsset(chain, address);
  if (!asset) notFound();
  return (
    <TokenTerminal
      token={{ chainId: asset.chainId, address: asset.address }}
      asset={asset}
    />
  );
}
