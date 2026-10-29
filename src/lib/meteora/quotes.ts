import BN from "bn.js";
import Decimal from "decimal.js";
import {
  getCurrentPoint,
  getPriceFromSqrtPrice,
  SwapMode,
  type PoolConfig,
  type VirtualPool,
} from "./sdk";
import type { MeteoraContext } from "./client";
import { RETRY_LAUNCH } from "./curve";

export type TradeSide = "buy" | "sell";

/** Allowed slippage range. 10% is the most RETRY lets a trader accept. */
export const MIN_SLIPPAGE_BPS = 10,
  MAX_SLIPPAGE_BPS = 1_000,
  DEFAULT_SLIPPAGE_BPS = 100;
/** A quote older than this must be refreshed before it can be executed. */
export const QUOTE_TTL_MS = 30_000;

export interface TradeQuote {
  side: TradeSide;
  pool: string;
  /** Input the wallet pays: lamports (buy) or raw token units (sell). */
  amountIn: bigint;
  /** Input the curve absorbs; a buy that completes the curve uses less. */
  amountInUsed: bigint;
  /** Input returned because the curve completed (partial fill). */
  amountLeft: bigint;
  /** Expected output: raw tokens (buy) or lamports (sell). */
  amountOut: bigint;
  /** Output floor written into the transaction. */
  minimumAmountOut: bigint;
  slippageBps: number;
  /** Total trading fee in lamports, and the Meteora protocol part of it. */
  fee: bigint;
  protocolFee: bigint;
  /** Lamports per whole token, before and at execution (display only). */
  spotPriceSol: string;
  executionPriceSol: string;
  /** Execution price vs. spot, in percent (positive = worse for the trader). */
  priceImpactPct: string;
  /** Whether this trade completes the curve and makes the pool graduate. */
  completesCurve: boolean;
  slot: number;
  quotedAt: number;
}

export class QuoteError extends Error {}

export function validateSlippage(bps: number) {
  if (
    !Number.isInteger(bps) ||
    bps < MIN_SLIPPAGE_BPS ||
    bps > MAX_SLIPPAGE_BPS
  )
    throw new QuoteError(
      `Slippage must be between ${MIN_SLIPPAGE_BPS / 100}% and ${MAX_SLIPPAGE_BPS / 100}%.`,
    );
  return bps;
}

const toBig = (value: BN | undefined | null) =>
  value ? BigInt(value.toString()) : 0n;

/**
 * Quote a trade with the SDK's port of the program's swap math, on the pool
 * state read at `slot`. Buys use PartialFill so the trade that completes the
 * curve fills and returns the rest; sells use ExactIn.
 */
export function quoteTrade(input: {
  side: TradeSide;
  pool: { address: string; raw: VirtualPool; config: PoolConfig; slot: number };
  amountIn: bigint;
  slippageBps: number;
  currentPoint: BN;
  context: MeteoraContext;
}): TradeQuote {
  const { side, pool, amountIn, context } = input;
  const slippageBps = validateSlippage(input.slippageBps);
  if (amountIn <= 0n)
    throw new QuoteError("Enter an amount greater than zero.");
  if (amountIn > (1n << 64n) - 1n) throw new QuoteError("Amount is too large.");
  if (pool.raw.poolState.isMigrated === 1)
    throw new QuoteError("This token graduated. Trade it on Meteora DAMM v2.");
  const threshold = toBig(pool.config.migrationQuoteThreshold);
  if (toBig(pool.raw.poolState.quoteReserve) >= threshold)
    throw new QuoteError(
      "The curve is complete. The pool is waiting to graduate.",
    );
  const buy = side === "buy";
  let result;
  try {
    result = context.client.pool.swapQuote2({
      virtualPool: pool.raw,
      config: pool.config,
      swapBaseForQuote: !buy,
      amountIn: new BN(amountIn.toString()),
      slippageBps,
      hasReferral: false,
      // RETRY's config does not enable a discounted first swap.
      eligibleForFirstSwapWithMinFee: false,
      currentPoint: input.currentPoint,
      swapMode: buy ? SwapMode.PartialFill : SwapMode.ExactIn,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    throw new QuoteError(
      /insufficient|Not enough liquidity/i.test(message)
        ? "Not enough liquidity in the curve for this amount."
        : "Quote unavailable for this amount.",
    );
  }
  const amountOut = toBig(result.outputAmount);
  if (amountOut <= 0n)
    throw new QuoteError("This amount is too small to trade.");
  const amountLeft = toBig(result.amountLeft);
  const used = amountIn - amountLeft;
  const spot = getPriceFromSqrtPrice(
    pool.raw.poolState.sqrtPrice,
    RETRY_LAUNCH.decimals,
    9,
  );
  // Execution price in SOL per whole token, fee included.
  const sol = new Decimal((buy ? used : amountOut).toString()).div(1e9);
  const tokens = new Decimal((buy ? amountOut : amountIn).toString()).div(
    10 ** RETRY_LAUNCH.decimals,
  );
  const execution = sol.div(tokens);
  const impact = buy
    ? execution.div(spot).minus(1)
    : new Decimal(1).minus(execution.div(spot));
  const nextQuoteReserve = buy
    ? toBig(pool.raw.poolState.quoteReserve) +
      toBig(result.excludedFeeInputAmount)
    : 0n;
  return {
    side,
    pool: pool.address,
    amountIn,
    amountInUsed: used,
    amountLeft,
    amountOut,
    minimumAmountOut: toBig(result.minimumAmountOut),
    slippageBps,
    fee:
      toBig(result.tradingFee) +
      toBig(result.protocolFee) +
      toBig(result.referralFee),
    protocolFee: toBig(result.protocolFee) + toBig(result.referralFee),
    spotPriceSol: spot.toSignificantDigits(6).toString(),
    executionPriceSol: execution.toSignificantDigits(6).toString(),
    priceImpactPct: impact.mul(100).toDecimalPlaces(2).toString(),
    completesCurve: buy && nextQuoteReserve >= threshold,
    slot: pool.slot,
    quotedAt: Date.now(),
  };
}

/** The chain's current point (timestamp for RETRY's config) for quoting. */
export function currentPoint(context: MeteoraContext, config: PoolConfig) {
  return getCurrentPoint(context.connection, config.activationType);
}

export function isQuoteFresh(quote: TradeQuote, now = Date.now()) {
  return now - quote.quotedAt <= QUOTE_TTL_MS;
}
