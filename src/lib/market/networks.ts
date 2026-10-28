import type { Address, Hex } from "viem";
import { MarketDataError } from "./errors";
import type { QuoteKind } from "./types";

/**
 * Networks with market data. Only Base mainnet: the providers index real
 * markets there, while Base Sepolia has no meaningful DEX market. Other
 * chains are refused so data from two networks is never mixed.
 */
export const MARKET_CHAIN_ID = 8453;

interface MarketNetwork {
  name: string;
  geckoterminal: string;
  dexscreener: string;
  explorer: string;
  /** Assets a primary pool may be priced against, by address (lower-case). */
  quoteAssets: Record<string, QuoteKind>;
}

export const MARKET_NETWORKS: Record<number, MarketNetwork> = {
  [MARKET_CHAIN_ID]: {
    name: "Base",
    geckoterminal: "base",
    dexscreener: "base",
    explorer: "https://basescan.org",
    quoteAssets: {
      // Uniswap v4 represents native ETH as the zero address.
      "0x0000000000000000000000000000000000000000": "native-eth",
      "0x4200000000000000000000000000000000000006": "weth",
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "usdc",
    },
  },
};

export function marketNetwork(chainId: number): MarketNetwork {
  const network = MARKET_NETWORKS[chainId];
  if (!network) throw new MarketDataError("UNSUPPORTED_CHAIN");
  return network;
}

export function isMarketChain(chainId: number) {
  return chainId in MARKET_NETWORKS;
}

export function quoteKind(chainId: number, address: Address): QuoteKind {
  return (
    MARKET_NETWORKS[chainId]?.quoteAssets[address.toLowerCase()] ?? "other"
  );
}

/** Explorer links are built from validated values on a fixed origin. */
export function explorerTokenUrl(chainId: number, address: Address) {
  return `${marketNetwork(chainId).explorer}/token/${address}`;
}
export function explorerTxUrl(chainId: number, hash: Hex) {
  return `${marketNetwork(chainId).explorer}/tx/${hash}`;
}
export function explorerAddressUrl(chainId: number, address: Address) {
  return `${marketNetwork(chainId).explorer}/address/${address}`;
}
