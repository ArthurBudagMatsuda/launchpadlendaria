// The few DAMM v2 (cp_amm) instruction and event layouts RETRY checks or
// decodes outside the SDK: the transaction allowlist and the trade history
// run on every page, and importing the whole DAMM v2 SDK there would load it
// on pages that never trade a graduated pool. The values are copied from the
// SDK's IDL (cp_amm 0.2.5) and tests/meteora-damm.test.ts fails if they drift.

/** Accounts of cp_amm `swap` and `swap2`, in IDL order. */
const SWAP_ACCOUNTS = [
  "pool_authority",
  "pool",
  "input_token_account",
  "output_token_account",
  "token_a_vault",
  "token_b_vault",
  "token_a_mint",
  "token_b_mint",
  "payer",
  "token_a_program",
  "token_b_program",
  "referral_token_account",
  "event_authority",
  "program",
] as const;

const POSITION_ACCOUNTS = [
  "pool_authority",
  "pool",
  "position",
  "token_a_account",
  "token_b_account",
  "token_a_vault",
  "token_b_vault",
  "token_a_mint",
  "token_b_mint",
  "position_nft_account",
  "signer",
  "token_a_program",
  "token_b_program",
  "event_authority",
  "program",
] as const;

export interface DammInstructionLayout {
  name: string;
  discriminator: readonly number[];
  accounts: readonly string[];
}

export const DAMM_V2_INSTRUCTIONS = {
  swap2: {
    name: "swap2",
    discriminator: [65, 75, 63, 76, 235, 91, 91, 136],
    accounts: SWAP_ACCOUNTS,
  },
  swap: {
    name: "swap",
    discriminator: [248, 198, 158, 145, 225, 117, 135, 200],
    accounts: SWAP_ACCOUNTS,
  },
  claim_position_fee: {
    name: "claim_position_fee",
    discriminator: [180, 38, 154, 17, 133, 33, 162, 211],
    accounts: POSITION_ACCOUNTS,
  },
} as const satisfies Record<string, DammInstructionLayout>;

export type DammInstructionName = keyof typeof DAMM_V2_INSTRUCTIONS;

export const DAMM_V2_EVENTS = {
  EvtSwap2: [189, 66, 51, 168, 38, 80, 117, 153],
  /** pool, position, owner, fee_a_claimed u64, fee_b_claimed u64. */
  EvtClaimPositionFee: [198, 182, 183, 52, 97, 12, 49, 56],
} as const;

/** Anchor's `emit_cpi!` tag: the first 8 bytes of a self-CPI event. */
export const ANCHOR_EVENT_IX_TAG = [228, 69, 165, 46, 81, 203, 154, 29];

/** cp_amm TradeDirection: AtoB sells the base token (A) for SOL (B). */
export const DAMM_TRADE_DIRECTION = { aToB: 0, bToA: 1 } as const;
