import { PublicKey } from "@solana/web3.js";
import {
  DAMM_V2_MIGRATION_FEE_ADDRESS,
  DAMM_V2_PROGRAM_ID,
  deriveDbcPoolAuthority,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  METAPLEX_PROGRAM_ID,
  MigrationFeeOption,
} from "./sdk";

// Program IDs come from the official SDK (2.0.0, DBC program 0.2.2) and are
// pinned again here, so an SDK upgrade that changes one fails the tests
// instead of silently pointing transactions somewhere else.
export const DBC_PROGRAM = new PublicKey(
  "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",
);
export const DAMM_V2_PROGRAM = new PublicKey(
  "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG",
);
export const METAPLEX_PROGRAM = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);
export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112",
);
export const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");
export const SPL_TOKEN_PROGRAM = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
/** DAMM v2 position NFTs are Token-2022 mints. */
export const TOKEN_2022_PROGRAM = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);
export const ASSOCIATED_TOKEN_PROGRAM = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);
export const COMPUTE_BUDGET_PROGRAM = new PublicKey(
  "ComputeBudget111111111111111111111111111111",
);
/**
 * DBC's pool authority PDA. At graduation it lends the rent for the DAMM v2
 * accounts and is repaid in the same instruction, so it must hold SOL on the
 * cluster (Meteora funds it).
 */
export const DBC_POOL_AUTHORITY = new PublicKey(
  "FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM",
);
/** Phantom adds Lighthouse assertions to transactions it signs. */
export const LIGHTHOUSE_PROGRAM = new PublicKey(
  "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95",
);

export function assertSdkProgramIds() {
  if (
    !DYNAMIC_BONDING_CURVE_PROGRAM_ID.equals(DBC_PROGRAM) ||
    !DAMM_V2_PROGRAM_ID.equals(DAMM_V2_PROGRAM) ||
    !METAPLEX_PROGRAM_ID.equals(METAPLEX_PROGRAM) ||
    !deriveDbcPoolAuthority().equals(DBC_POOL_AUTHORITY)
  )
    throw new Error("Meteora SDK program IDs changed. Review before use.");
}

/** The public DAMM v2 config a graduated pool is created with, per fee option. */
export function dammV2ConfigFor(option: number) {
  const key = DAMM_V2_MIGRATION_FEE_ADDRESS[option];
  if (!key || option === MigrationFeeOption.Customizable)
    throw new Error("Unsupported graduated pool fee option.");
  return key;
}
