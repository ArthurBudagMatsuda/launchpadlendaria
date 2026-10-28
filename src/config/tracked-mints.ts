import type { SolanaAddress } from "@/lib/solana/address";
import type { SolanaCluster } from "@/config/solana";
export interface TrackedAsset {
  slug: string;
  cluster: SolanaCluster;
  address: SolanaAddress;
  relation: "external-tracked" | "retry-curve" | "retry-graduated";
  status: "active" | "paused";
  primaryPool: { id: SolanaAddress; rationale: string } | null;
  verification: {
    name: string;
    symbol: string;
    checkedAt: string;
    evidence: string;
  };
  logo?: {
    src: string;
    source: string;
    sha256: string;
    checkedAt: string;
    evidence: string;
    listedBy: string;
  };
}
// A mint must be explicitly reviewed for its cluster before becoming a listing.
// No replacement asset is invented or automatically selected by the migration.
export const TRACKED_ASSETS: readonly TrackedAsset[] = [];
export const FEATURED_ASSET: TrackedAsset | undefined = TRACKED_ASSETS.find(
  (asset) => asset.status === "active",
);
export const tokenHref = (asset: Pick<TrackedAsset, "cluster" | "address">) =>
  `/token/?cluster=${asset.cluster}&mint=${asset.address}`;
