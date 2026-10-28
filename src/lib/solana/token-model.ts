import type { SolanaAddress } from "./address";
import type { SolanaCluster } from "@/config/solana";
import type { TokenProgram } from "./rpc";
/** Read models only. No creation, derivation, signing or transfer instructions. */
export interface MintIdentity {
  cluster: SolanaCluster;
  mint: SolanaAddress;
  tokenProgram: TokenProgram;
}
export interface SplMint extends MintIdentity {
  decimals: number;
  supplyRaw: bigint;
  mintAuthority: SolanaAddress | null;
  freezeAuthority: SolanaAddress | null;
}
export interface SplTokenAccount extends MintIdentity {
  address: SolanaAddress;
  owner: SolanaAddress;
  amountRaw: bigint;
  state: "initialized" | "frozen";
  delegate: SolanaAddress | null;
}
/** ATA identity includes the Token Program; it is not interchangeable across programs. */
export interface AssociatedTokenAccount extends SplTokenAccount {
  associated: true;
  associatedTokenProgram: SolanaAddress;
}
export type Token2022ExtensionReview =
  | { status: "unreviewed" }
  | { status: "reviewed"; extensions: readonly string[]; reviewedAt: string };
export const U64_MAX = (1n << 64n) - 1n;
export function rawSupply(wholeTokens: bigint, decimals: number) {
  if (
    wholeTokens < 0n ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 19
  )
    throw new Error("Unsupported supply precision.");
  const raw = wholeTokens * 10n ** BigInt(decimals);
  if (raw > U64_MAX) throw new Error("Supply exceeds SPL uint64.");
  return raw;
}
