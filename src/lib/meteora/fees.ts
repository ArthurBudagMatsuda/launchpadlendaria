import BN from "bn.js";
import type { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  PROTOCOL_FEE_PERCENT,
  PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS,
} from "./sdk";
import { assertCluster, assertWritable, type MeteoraContext } from "./client";
import { RETRY_LAUNCH } from "./curve";
import { graduatedFeeBps } from "./graduation";
import { readRetryPool } from "./pools";
import { WSOL_MINT } from "./programs";
import type { TxExpectation } from "./transactions";

/**
 * How one trading fee is split by the DBC program: Meteora's protocol share
 * first, then the rest between the partner (RETRY's config fee claimer) and
 * the token creator. There is no referral account in RETRY trades.
 */
export function splitTradingFee(fee: bigint) {
  const protocol = (fee * BigInt(PROTOCOL_FEE_PERCENT)) / 100n;
  const rest = fee - protocol;
  const creator = (rest * BigInt(RETRY_LAUNCH.creatorTradingFeePercent)) / 100n;
  return { protocol, creator, partner: rest - creator };
}

/** Every fee a RETRY launch can charge, as percentages, for display. */
export function feeSchedule() {
  const trading = RETRY_LAUNCH.tradingFeeBps / 100;
  const protocol = (trading * PROTOCOL_FEE_PERCENT) / 100;
  const shared = trading - protocol;
  const creator = (shared * RETRY_LAUNCH.creatorTradingFeePercent) / 100;
  return {
    tradingPct: trading,
    protocolPct: protocol,
    creatorPct: creator,
    partnerPct: shared - creator,
    /** RETRY charges nothing to create a pool. */
    poolCreationSol: 0,
    /** Fixed Meteora fee on liquidity at graduation, and RETRY's (none). */
    migrationProtocolPct: PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS / 100,
    migrationPartnerPct: 0,
    /** LP fee of the graduated DAMM v2 pool. */
    graduatedLpPct: (graduatedFeeBps() ?? 0) / 100,
  };
}

/**
 * Build the creator's claim of the trading fees the pool holds for them.
 * Only the pool's creator can sign it; fees arrive as SOL.
 */
export async function prepareCreatorClaim(
  context: MeteoraContext,
  input: { creator: PublicKey; pool: PublicKey },
): Promise<{ tx: Transaction; amount: bigint; expect: TxExpectation }> {
  assertWritable(context);
  await assertCluster(context);
  const read = await readRetryPool(context, input.pool);
  if (!read.raw.poolState.creator.equals(input.creator))
    throw new Error(
      "Only the creator of this token can claim its creator fees.",
    );
  const quote = read.pool.creatorQuoteFee;
  const base = BigInt(read.raw.poolState.creatorBaseFee.toString());
  if (quote === 0n && base === 0n)
    throw new Error("There are no creator fees to claim.");
  const tx = await context.client.creator.claimCreatorTradingFee({
    creator: input.creator,
    payer: input.creator,
    pool: input.pool,
    maxBaseAmount: new BN(base.toString()),
    maxQuoteAmount: new BN(quote.toString()),
  });
  tx.feePayer = input.creator;
  const mint = read.raw.poolState.baseMint;
  return {
    tx,
    amount: quote,
    expect: {
      owner: input.creator,
      dbc: ["claim_creator_trading_fee"],
      accounts: {
        pool: input.pool,
        creator: input.creator,
        base_mint: mint,
        quote_mint: WSOL_MINT,
        base_vault: read.raw.poolState.baseVault,
        quote_vault: read.raw.poolState.quoteVault,
        token_a_account: getAssociatedTokenAddressSync(
          mint,
          input.creator,
          true,
        ),
        token_b_account: getAssociatedTokenAddressSync(
          WSOL_MINT,
          input.creator,
          true,
        ),
      },
      ataMints: [mint, WSOL_MINT],
    },
  };
}
