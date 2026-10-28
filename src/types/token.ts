import type { Address } from "viem";

export type LaunchStage = "new" | "graduating" | "graduated";
export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}
export interface TokenMarketData {
  priceUsd: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  liquidity: number;
  holders: number;
}
export interface BondingCurveState {
  progress: number;
  source: "demo" | "onchain";
}
export interface TokenLaunch {
  stage: LaunchStage;
  createdAt: string;
  creatorLabel: string;
  curve: BondingCurveState;
}
export interface Token {
  id: string;
  metadata: TokenMetadata;
  market: TokenMarketData;
  launch: TokenLaunch;
  contractAddress?: Address;
  demoReference: string;
  isDemo: boolean;
  accent: string;
}
export interface PricePoint {
  time: string;
  price: number;
  volume: number;
}
export interface Trade {
  id: string;
  side: "buy" | "sell";
  amount: number;
  priceUsd: number;
  walletLabel: string;
  minutesAgo: number;
  isDemo: boolean;
}
export interface UserPortfolio {
  address: Address;
  chainId: number;
  createdTokens: Token[];
  holdings: { tokenId: string; balance: string }[];
  activity: Trade[];
}
