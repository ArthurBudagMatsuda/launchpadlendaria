import BN from "bn.js";
import type { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SwapMode } from "./sdk";
import { assertCluster, assertWritable, type MeteoraContext } from "./client";
import { readRetryPool, type RetryPool } from "./pools";
import { DBC_PROGRAM, WSOL_MINT } from "./programs";
import {
  currentPoint,
  isQuoteFresh,
  QuoteError,
  quoteTrade,
  type TradeQuote,
} from "./quotes";
import type { TxExpectation } from "./transactions";

export interface PreparedTrade {
  tx: Transaction;
  /** Quote re-read from the pool right before building; this is what is shown. */
  quote: TradeQuote;
  pool: RetryPool;
  expect: TxExpectation;
}

/**
 * Re-read the pool, re-quote, and build a swap2 transaction whose output
 * floor is the fresh quote's minimum. A stale or changed quote is refused, so
 * the wallet is never asked to sign terms the user did not see.
 */
export async function prepareTrade(
  context: MeteoraContext,
  input: {
    owner: PublicKey;
    pool: PublicKey;
    side: TradeQuote["side"];
    amountIn: bigint;
    slippageBps: number;
    /** The quote the user reviewed. Building fails if it moved against them. */
    reviewed: TradeQuote;
  },
): Promise<PreparedTrade> {
  assertWritable(context);
  await assertCluster(context);
  if (!isQuoteFresh(input.reviewed))
    throw new QuoteError("The quote expired. Review the new quote first.");
  const read = await readRetryPool(context, input.pool);
  const point = await currentPoint(context, read.config);
  const quote = quoteTrade({
    side: input.side,
    pool: {
      address: input.pool.toBase58(),
      raw: read.raw,
      config: read.config,
      slot: read.pool.slot,
    },
    amountIn: input.amountIn,
    slippageBps: input.slippageBps,
    currentPoint: point,
    context,
  });
  if (
    input.reviewed.side !== quote.side ||
    input.reviewed.amountIn !== quote.amountIn ||
    input.reviewed.slippageBps !== quote.slippageBps ||
    quote.minimumAmountOut < input.reviewed.minimumAmountOut
  )
    throw new QuoteError("The price moved. Review the new quote first.");
  const mint = read.raw.poolState.baseMint;
  const buy = input.side === "buy";
  if (!buy) {
    const balance = await tokenBalance(context, input.owner, mint);
    if (balance < input.amountIn)
      throw new QuoteError("You do not hold that many tokens.");
  }
  const tx = await context.client.pool.swap2({
    owner: input.owner,
    pool: input.pool,
    swapBaseForQuote: !buy,
    referralTokenAccount: null,
    payer: input.owner,
    // PartialFill lets the buy that completes the curve fill and refund the
    // rest; the floor still applies to what is filled.
    ...(buy
      ? {
          swapMode: SwapMode.PartialFill as const,
          amountIn: new BN(quote.amountIn.toString()),
          minimumAmountOut: new BN(quote.minimumAmountOut.toString()),
        }
      : {
          swapMode: SwapMode.ExactIn as const,
          amountIn: new BN(quote.amountIn.toString()),
          minimumAmountOut: new BN(quote.minimumAmountOut.toString()),
        }),
  });
  tx.feePayer = input.owner;
  const baseAta = getAssociatedTokenAddressSync(mint, input.owner, true);
  const wsolAta = getAssociatedTokenAddressSync(WSOL_MINT, input.owner, true);
  return {
    tx,
    quote,
    pool: read.pool,
    expect: {
      owner: input.owner,
      dbc: ["swap2"],
      accounts: {
        pool: input.pool,
        config: read.raw.poolState.config,
        base_mint: mint,
        quote_mint: WSOL_MINT,
        base_vault: read.raw.poolState.baseVault,
        quote_vault: read.raw.poolState.quoteVault,
        input_token_account: buy ? wsolAta : baseAta,
        output_token_account: buy ? baseAta : wsolAta,
        payer: input.owner,
        // Anchor passes the program ID for an absent optional account.
        referral_token_account: DBC_PROGRAM,
      },
      ataMints: [mint, WSOL_MINT],
    },
  };
}

/** Raw token balance of the owner's associated account (0 if none). */
export async function tokenBalance(
  context: MeteoraContext,
  owner: PublicKey,
  mint: PublicKey,
) {
  const ata = getAssociatedTokenAddressSync(mint, owner, true);
  const info = await context.connection.getAccountInfo(ata, "confirmed");
  if (!info) return 0n;
  const { value } = await context.connection.getTokenAccountBalance(
    ata,
    "confirmed",
  );
  return BigInt(value.amount);
}

/** Lamports already wrapped in the owner's WSOL account; a swap unwraps them. */
export async function wrappedSolBalance(
  context: MeteoraContext,
  owner: PublicKey,
) {
  return tokenBalance(context, owner, WSOL_MINT);
}
