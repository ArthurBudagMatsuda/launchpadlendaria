import { getAddress, type Address, type Hex } from "viem";
import type {
  DexProtocol,
  MarketSourceId,
  QuoteKind,
} from "@/lib/market/types";

/**
 * The single source of truth for tokens RETRY tracks. Every page, route and
 * hook reads tracked tokens from here; no component hardcodes an address.
 *
 * `relation` keeps external tokens apart from RETRY's own future launches:
 * a tracked token is shown as "Tracked on RETRY", never as a RETRY launch,
 * until a verified RETRY factory event says otherwise.
 *
 * `verification` records how and when the identity was checked. Pages read
 * name, symbol, decimals and supply live from Base RPC; the snapshot is only
 * used for static metadata (page titles) and to flag a later change.
 */
export type TokenRelation =
  "external-tracked" | "retry-curve" | "retry-graduated";

export interface TrackedAsset {
  /** URL segment under /token/<chain>/. Always the lower-case address. */
  slug: string;
  chainId: number;
  chainSlug: "base";
  address: Address;
  relation: TokenRelation;
  status: "active" | "paused";
  providers: { primary: MarketSourceId; fallback: MarketSourceId | null };
  primaryPool: {
    id: Hex;
    protocol: DexProtocol;
    quote: QuoteKind;
    quoteSymbol: string;
    /** Why this pool, in one line (shown on the token page). */
    rationale: string;
  } | null;
  verification: {
    checkedAt: string;
    method: string;
    evidence: string;
    blockNumber: number;
    standard: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupplyRaw: string;
  };
}

const worth = getAddress("0xb200000000000000000000585fd80c20af698f01");

export const TRACKED_ASSETS: readonly TrackedAsset[] = [
  {
    slug: worth.toLowerCase(),
    chainId: 8453,
    chainSlug: "base",
    address: worth,
    relation: "external-tracked",
    status: "active",
    providers: { primary: "geckoterminal", fallback: "dexscreener" },
    primaryPool: {
      id: "0x6cf637a82362d304dfa56a6387fc8f909ec0008ec520ee5fb999506d9b1f3514",
      protocol: "uniswap-v4",
      quote: "native-eth",
      quoteSymbol: "ETH",
      rationale:
        "Deepest worth pool priced in ETH, WETH or USDC with continuous trading, listed by both GeckoTerminal and DEX Screener (Uniswap v4).",
    },
    verification: {
      checkedAt: "2026-10-28T03:01:09Z",
      method:
        "Base mainnet RPC: eth_chainId, eth_getCode, ERC-20 name/symbol/decimals/totalSupply, B20 factory isB20 and isB20Initialized",
      evidence:
        "https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40624224187",
      blockNumber: 53183561,
      standard: "B20 (Base native token standard, ASSET variant)",
      name: "one life, its worth an attempt",
      symbol: "worth",
      decimals: 18,
      totalSupplyRaw: "1000000000000000000000000000",
    },
  },
];

export const FEATURED_ASSET: TrackedAsset | undefined = TRACKED_ASSETS.find(
  (asset) => asset.status === "active",
);

export function findTrackedAsset(chainSlug: string, slug: string) {
  return TRACKED_ASSETS.find(
    (asset) =>
      asset.chainSlug === chainSlug && asset.slug === slug.toLowerCase(),
  );
}

export function findTrackedByAddress(chainId: number, address: string) {
  return TRACKED_ASSETS.find(
    (asset) =>
      asset.chainId === chainId &&
      asset.address.toLowerCase() === address.toLowerCase(),
  );
}

export function tokenHref(asset: Pick<TrackedAsset, "chainSlug" | "slug">) {
  return `/token/${asset.chainSlug}/${asset.slug}`;
}
