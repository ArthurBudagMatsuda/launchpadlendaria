import { Buffer } from "buffer";
import BN from "bn.js";
import Decimal from "decimal.js";
import { PublicKey, type Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  CP_AMM_PROGRAM_ID,
  CpAmm,
  derivePoolAuthority,
  derivePositionAddress,
  derivePositionNftAccount,
  getPriceFromSqrtPrice,
  getCurrentPoint,
  getUnClaimLpFee,
  SwapMode,
  swapQuoteExactInput,
  type PoolState,
  type PositionState,
} from "./damm-sdk";
import { assertCluster, assertWritable, type MeteoraContext } from "./client";
import { RETRY_LAUNCH } from "./curve";
import { readRetryPool, type RetryPool } from "./pools";
import {
  DAMM_V2_PROGRAM,
  SPL_TOKEN_PROGRAM,
  TOKEN_2022_PROGRAM,
  WSOL_MINT,
} from "./programs";
import {
  isQuoteFresh,
  QuoteError,
  validateSlippage,
  type TradeQuote,
  type TradeSide,
} from "./quotes";
import { tokenBalance } from "./trade";
import type { TxExpectation } from "./transactions";

/** cp_amm's pool authority PDA (the vaults' owner). */
export const DAMM_V2_POOL_AUTHORITY = derivePoolAuthority();
/** Anchor's `#[event_cpi]` authority PDA of cp_amm. */
export const DAMM_V2_EVENT_AUTHORITY = PublicKey.findProgramAddressSync(
  [Buffer.from("__event_authority")],
  DAMM_V2_PROGRAM,
)[0];

const clients = new WeakMap<MeteoraContext["connection"], CpAmm>();
function dammClient(context: MeteoraContext) {
  let client = clients.get(context.connection);
  if (!client) {
    // Same guard as the DBC SDK: an SDK upgrade that moves the program fails.
    if (!CP_AMM_PROGRAM_ID.equals(DAMM_V2_PROGRAM))
      throw new Error("DAMM v2 SDK program ID changed. Review before use.");
    client = new CpAmm(context.connection);
    clients.set(context.connection, client);
  }
  return client;
}

const big = (value: BN | number) => BigInt(new BN(value).toString());

/** A graduated RETRY pool on DAMM v2, read and checked at a known slot. */
export interface DammPool {
  address: string;
  /** The DBC pool it graduated from. */
  dbcPool: string;
  baseMint: string;
  tokenAVault: string;
  tokenBVault: string;
  /** Vault balances in raw units (tokens, lamports). Real, not virtual. */
  baseReserve: bigint;
  quoteReserve: bigint;
  sqrtPrice: bigint;
  liquidity: bigint;
  /** Liquidity the program holds as permanently locked across positions. */
  permanentLockLiquidity: bigint;
  /** Spot price in SOL per whole token and FDV, display only. */
  priceSol: string;
  fdvSol: string;
  /** Base fee in basis points (cliff fee of the pool's fee scheduler). */
  feeBps: number;
  /** Meteora's protocol share of each fee, in percent. */
  protocolFeePercent: number;
  /** cp_amm CollectFeeMode: 1 = fees taken in SOL only. */
  collectFeeMode: number;
  enabled: boolean;
  activationPoint: bigint;
  activationType: number;
  slot: number;
}

export class DammPoolError extends Error {}

/**
 * Every check that makes a DAMM v2 pool the graduated pool of a RETRY
 * launch: owned by cp_amm, at the PDA the DBC migration derives from the
 * RETRY launch's DAMM v2 config, holding the launch's mint against WSOL in
 * SPL Token vaults. Reading a pool that fails any check throws.
 */
export function validateDammPool(
  launch: RetryPool,
  address: PublicKey,
  owner: PublicKey,
  state: PoolState,
) {
  if (!owner.equals(DAMM_V2_PROGRAM))
    throw new DammPoolError("Pool is not owned by Meteora DAMM v2.");
  if (!launch.dammV2Pool || launch.dammV2Pool !== address.toBase58())
    throw new DammPoolError(
      "Pool is not the graduated pool of this RETRY launch.",
    );
  if (
    !state.tokenAMint.equals(new PublicKey(launch.baseMint)) ||
    !state.tokenBMint.equals(WSOL_MINT)
  )
    throw new DammPoolError("Pool does not pair this token with SOL.");
  // token_a_flag / token_b_flag: 0 = SPL Token, 1 = Token-2022.
  if (state.tokenAFlag !== 0 || state.tokenBFlag !== 0)
    throw new DammPoolError("Pool uses an unexpected token program.");
}

function feeBpsOf(state: PoolState) {
  // The base fee's first u64 is the cliff fee numerator (denominator 1e9).
  const data = Buffer.from(state.poolFees.baseFee.baseFeeInfo.data);
  return Number(data.readBigUInt64LE(0) / 100_000n);
}

/** Read the graduated pool of a RETRY launch. Throws if it is not one. */
export async function readDammPool(
  context: MeteoraContext,
  launch: RetryPool,
): Promise<{ pool: DammPool; state: PoolState }> {
  if (!launch.dammV2Pool)
    throw new DammPoolError("This token has not graduated yet.");
  const address = new PublicKey(launch.dammV2Pool);
  const { context: rpc, value } =
    await context.connection.getAccountInfoAndContext(address, "confirmed");
  if (!value) throw new DammPoolError("DAMM v2 pool not found.");
  const client = dammClient(context);
  const state = client._program.coder.accounts.decode<PoolState>(
    "pool",
    value.data,
  );
  validateDammPool(launch, address, value.owner, state);
  const vaults = await context.connection.getMultipleAccountsInfo(
    [state.tokenAVault, state.tokenBVault],
    "confirmed",
  );
  // SPL Token account amount sits at offset 64; vaults are owned by the
  // DAMM v2 pool authority and must hold the pool's mints.
  const amount = (index: number, mint: PublicKey) => {
    const info = vaults[index];
    if (!info || !info.owner.equals(SPL_TOKEN_PROGRAM))
      throw new DammPoolError("Pool vault is missing.");
    if (
      !new PublicKey(info.data.subarray(0, 32)).equals(mint) ||
      !new PublicKey(info.data.subarray(32, 64)).equals(DAMM_V2_POOL_AUTHORITY)
    )
      throw new DammPoolError("Pool vault is not the pool's.");
    return info.data.readBigUInt64LE(64);
  };
  const baseReserve = amount(0, state.tokenAMint);
  const quoteReserve = amount(1, state.tokenBMint);
  const price = getPriceFromSqrtPrice(
    state.sqrtPrice,
    RETRY_LAUNCH.decimals,
    9,
  );
  return {
    state,
    pool: {
      address: address.toBase58(),
      dbcPool: launch.address,
      baseMint: launch.baseMint,
      tokenAVault: state.tokenAVault.toBase58(),
      tokenBVault: state.tokenBVault.toBase58(),
      baseReserve,
      quoteReserve,
      sqrtPrice: big(state.sqrtPrice),
      liquidity: big(state.liquidity),
      permanentLockLiquidity: big(state.permanentLockLiquidity),
      priceSol: price.toSignificantDigits(6).toString(),
      fdvSol: price.mul(RETRY_LAUNCH.totalSupply).toDecimalPlaces(4).toString(),
      feeBps: feeBpsOf(state),
      protocolFeePercent: state.poolFees.protocolFeePercent,
      collectFeeMode: state.collectFeeMode,
      enabled: state.poolStatus === 0,
      activationPoint: big(state.activationPoint),
      activationType: state.activationType,
      slot: rpc.slot,
    },
  };
}

/**
 * Quote a trade on the graduated pool with the SDK's port of cp_amm's swap
 * math (ExactIn both ways), on the pool state read at `slot`. The quote has
 * the same shape as a curve quote, so the trade page renders either.
 */
export function quoteDammTrade(input: {
  side: TradeSide;
  pool: DammPool;
  state: PoolState;
  amountIn: bigint;
  slippageBps: number;
  currentPoint: BN;
}): TradeQuote {
  const { side, pool, state, amountIn } = input;
  const slippageBps = validateSlippage(input.slippageBps);
  if (amountIn <= 0n)
    throw new QuoteError("Enter an amount greater than zero.");
  if (amountIn > (1n << 64n) - 1n) throw new QuoteError("Amount is too large.");
  if (!pool.enabled)
    throw new QuoteError("Trading is paused on this DAMM v2 pool.");
  const buy = side === "buy";
  let result;
  try {
    // What CpAmm.getQuote2 runs for ExactIn; token A (the launch) → B
    // (WSOL) is a sell. SPL Token mints carry no transfer fee to pass in.
    result = swapQuoteExactInput(
      state,
      input.currentPoint,
      new BN(amountIn.toString()),
      slippageBps,
      !buy,
      false,
      RETRY_LAUNCH.decimals,
      9,
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    throw new QuoteError(
      /swap.*disabled/i.test(message)
        ? "Trading has not started on this DAMM v2 pool yet."
        : /liquidity|price range/i.test(message)
          ? "Not enough liquidity in the pool for this amount."
          : "Quote unavailable for this amount.",
    );
  }
  const amountOut = BigInt(result.outputAmount.toString());
  if (amountOut <= 0n)
    throw new QuoteError("This amount is too small to trade.");
  const fee =
    BigInt(result.claimingFee.toString()) +
    BigInt(result.protocolFee.toString()) +
    BigInt(result.compoundingFee.toString()) +
    BigInt(result.referralFee.toString());
  const spot = getPriceFromSqrtPrice(state.sqrtPrice, RETRY_LAUNCH.decimals, 9);
  const sol = new Decimal((buy ? amountIn : amountOut).toString()).div(1e9);
  const tokens = new Decimal((buy ? amountOut : amountIn).toString()).div(
    10 ** RETRY_LAUNCH.decimals,
  );
  const execution = sol.div(tokens);
  const impact = buy
    ? execution.div(spot).minus(1)
    : new Decimal(1).minus(execution.div(spot));
  return {
    venue: "damm-v2",
    side,
    pool: pool.address,
    amountIn,
    amountInUsed: amountIn,
    amountLeft: 0n,
    amountOut,
    minimumAmountOut: BigInt(result.minimumAmountOut!.toString()),
    slippageBps,
    fee,
    protocolFee: BigInt(result.protocolFee.toString()),
    spotPriceSol: spot.toSignificantDigits(6).toString(),
    executionPriceSol: execution.toSignificantDigits(6).toString(),
    priceImpactPct: impact.mul(100).toDecimalPlaces(2).toString(),
    completesCurve: false,
    slot: pool.slot,
    quotedAt: Date.now(),
  };
}

/** The chain's current point in the pool's activation unit (slot or time). */
export function dammCurrentPoint(context: MeteoraContext, pool: DammPool) {
  return getCurrentPoint(context.connection, pool.activationType);
}

export interface PreparedDammTrade {
  tx: Transaction;
  quote: TradeQuote;
  pool: DammPool;
  expect: TxExpectation;
}

/**
 * Re-read the launch and its graduated pool, re-quote, and build a cp_amm
 * swap2 (ExactIn) whose output floor is the fresh quote's minimum. Refuses a
 * stale quote or one that moved against the trader, like the curve trade.
 */
export async function prepareDammTrade(
  context: MeteoraContext,
  input: {
    owner: PublicKey;
    /** The launch's DBC pool: the DAMM v2 pool is derived from it, never passed in. */
    launch: PublicKey;
    side: TradeSide;
    amountIn: bigint;
    slippageBps: number;
    reviewed: TradeQuote;
  },
): Promise<PreparedDammTrade> {
  if (input.reviewed.venue !== "damm-v2")
    throw new QuoteError("This quote is for the bonding curve. Refresh it.");
  assertWritable(context, "trade-damm");
  await assertCluster(context);
  if (!isQuoteFresh(input.reviewed))
    throw new QuoteError("The quote expired. Review the new quote first.");
  const launch = await readRetryPool(context, input.launch);
  if (launch.pool.status !== "graduated")
    throw new QuoteError("This token has not graduated to DAMM v2.");
  const { pool, state } = await readDammPool(context, launch.pool);
  if (input.reviewed.pool !== pool.address)
    throw new QuoteError("The quote is for another pool. Refresh it.");
  const quote = quoteDammTrade({
    side: input.side,
    pool,
    state,
    amountIn: input.amountIn,
    slippageBps: input.slippageBps,
    currentPoint: await dammCurrentPoint(context, pool),
  });
  if (
    input.reviewed.side !== quote.side ||
    input.reviewed.amountIn !== quote.amountIn ||
    input.reviewed.slippageBps !== quote.slippageBps ||
    quote.minimumAmountOut < input.reviewed.minimumAmountOut
  )
    throw new QuoteError("The price moved. Review the new quote first.");
  const mint = state.tokenAMint;
  const buy = input.side === "buy";
  if (!buy) {
    const balance = await tokenBalance(context, input.owner, mint);
    if (balance < input.amountIn)
      throw new QuoteError("You do not hold that many tokens.");
  }
  const address = new PublicKey(pool.address);
  const tx = await dammClient(context).swap2({
    payer: input.owner,
    pool: address,
    inputTokenMint: buy ? WSOL_MINT : mint,
    outputTokenMint: buy ? mint : WSOL_MINT,
    tokenAMint: mint,
    tokenBMint: WSOL_MINT,
    tokenAVault: state.tokenAVault,
    tokenBVault: state.tokenBVault,
    tokenAProgram: SPL_TOKEN_PROGRAM,
    tokenBProgram: SPL_TOKEN_PROGRAM,
    referralTokenAccount: null,
    poolState: state,
    swapMode: SwapMode.ExactIn,
    amountIn: new BN(quote.amountIn.toString()),
    minimumAmountOut: new BN(quote.minimumAmountOut.toString()),
  });
  tx.feePayer = input.owner;
  const baseAta = getAssociatedTokenAddressSync(mint, input.owner, true);
  const wsolAta = getAssociatedTokenAddressSync(WSOL_MINT, input.owner, true);
  return {
    tx,
    quote,
    pool,
    expect: {
      owner: input.owner,
      dbc: [],
      damm: ["swap2"],
      accounts: {
        pool_authority: DAMM_V2_POOL_AUTHORITY,
        pool: address,
        input_token_account: buy ? wsolAta : baseAta,
        output_token_account: buy ? baseAta : wsolAta,
        token_a_vault: state.tokenAVault,
        token_b_vault: state.tokenBVault,
        token_a_mint: mint,
        token_b_mint: WSOL_MINT,
        payer: input.owner,
        token_a_program: SPL_TOKEN_PROGRAM,
        token_b_program: SPL_TOKEN_PROGRAM,
        // Anchor passes the program ID for an absent optional account.
        referral_token_account: DAMM_V2_PROGRAM,
        event_authority: DAMM_V2_EVENT_AUTHORITY,
        program: DAMM_V2_PROGRAM,
      },
      ataMints: [mint, WSOL_MINT],
    },
  };
}

/** One of the two LP positions the graduation created, read on-chain. */
export interface LockedPosition {
  position: string;
  nftMint: string;
  /** Token-2022 account holding the position NFT, and its owner (fee rights). */
  nftAccount: string | null;
  holder: string | null;
  unlockedLiquidity: bigint;
  vestedLiquidity: bigint;
  permanentLockedLiquidity: bigint;
  /** LP fees credited to the position at its last update, raw units. */
  feeAPending: bigint;
  feeBPending: bigint;
  /**
   * LP fees claimable now (pending plus what the pool accrued since), when
   * the pool state was given; feeB is SOL in lamports.
   */
  feeAClaimable: bigint | null;
  feeBClaimable: bigint | null;
}

/** What the program state proves about the graduated liquidity. */
export interface LockVerification {
  /** The two positions the graduation created (largest permanent locks). */
  positions: LockedPosition[];
  /** Positions other wallets opened in the pool later, if any. */
  others: LockedPosition[];
  totalLiquidity: bigint;
  /** Permanently locked liquidity across every position of the pool. */
  permanentLocked: bigint;
  /** Unlocked and vesting liquidity of the graduated positions. */
  unlocked: bigint;
  vested: bigint;
  /** Share of the pool's liquidity that is permanently locked, percent. */
  lockedPct: string;
  /**
   * True when the graduated liquidity can never be withdrawn beyond DBC's
   * rounding remainder: two locked positions, nothing vesting, at most 1
   * unit unlocked in each, and the pool's own permanent-lock total equal to
   * the sum over its positions.
   */
  verified: boolean;
}

const nftHeld = (data: Buffer, mint: PublicKey) =>
  data.length >= 72 &&
  new PublicKey(data.subarray(0, 32)).equals(mint) &&
  data.readBigUInt64LE(64) === 1n;

/**
 * Where a position NFT is now: its first account (the cp_amm PDA) or, once
 * moved, the one Token-2022 account that holds it.
 */
async function nftHolder(context: MeteoraContext, nftMint: PublicKey) {
  const pda = derivePositionNftAccount(nftMint);
  const first = await context.connection.getAccountInfo(pda, "confirmed");
  if (first?.owner.equals(TOKEN_2022_PROGRAM) && nftHeld(first.data, nftMint))
    return {
      account: pda.toBase58(),
      holder: new PublicKey(first.data.subarray(32, 64)).toBase58(),
    };
  const largest = await context.connection.getTokenLargestAccounts(
    nftMint,
    "confirmed",
  );
  const top = largest.value.find((a) => a.amount === "1");
  if (!top) return null;
  const moved = await context.connection.getAccountInfo(
    top.address,
    "confirmed",
  );
  if (!moved?.owner.equals(TOKEN_2022_PROGRAM) || !nftHeld(moved.data, nftMint))
    return null;
  return {
    account: top.address.toBase58(),
    holder: new PublicKey(moved.data.subarray(32, 64)).toBase58(),
  };
}

/**
 * Check a pool's lock from its positions' state. The graduated positions
 * are the two with the largest permanent locks: anyone may open (and lock)
 * a position in the pool later, and that never makes the graduated
 * liquidity withdrawable, so it is reported apart instead of failing the
 * check.
 */
export function checkLock(
  dammPool: Pick<DammPool, "liquidity" | "permanentLockLiquidity">,
  all: LockedPosition[],
): LockVerification {
  const ranked = [...all].sort((a, b) =>
    b.permanentLockedLiquidity > a.permanentLockedLiquidity
      ? 1
      : b.permanentLockedLiquidity < a.permanentLockedLiquidity
        ? -1
        : 0,
  );
  const positions = ranked
    .slice(0, 2)
    .filter((p) => p.permanentLockedLiquidity > 0n);
  const others = ranked.filter((p) => !positions.includes(p));
  const sum = (list: LockedPosition[], pick: (p: LockedPosition) => bigint) =>
    list.reduce((total, p) => total + pick(p), 0n);
  const permanentLocked = sum(all, (p) => p.permanentLockedLiquidity);
  return {
    positions,
    others,
    totalLiquidity: dammPool.liquidity,
    permanentLocked,
    unlocked: sum(positions, (p) => p.unlockedLiquidity),
    vested: sum(positions, (p) => p.vestedLiquidity),
    lockedPct:
      dammPool.liquidity > 0n
        ? new Decimal(permanentLocked.toString())
            .div(dammPool.liquidity.toString())
            .mul(100)
            .toDecimalPlaces(6, Decimal.ROUND_DOWN)
            .toString()
        : "0",
    verified:
      positions.length === 2 &&
      positions.every(
        (p) => p.vestedLiquidity === 0n && p.unlockedLiquidity <= 1n,
      ) &&
      permanentLocked === dammPool.permanentLockLiquidity &&
      permanentLocked > 0n,
  };
}

/**
 * Read every position of the graduated pool (getProgramAccounts by pool)
 * and who holds each position NFT, then check the lock. With the pool's
 * state, each position's claimable LP fees are computed too.
 */
export async function verifyLockedLiquidity(
  context: MeteoraContext,
  dammPool: DammPool,
  state?: PoolState,
): Promise<LockVerification> {
  const client = dammClient(context);
  const address = new PublicKey(dammPool.address);
  const positions = await client.getAllPositionsByPool(address);
  const read: LockedPosition[] = [];
  for (const { publicKey, account } of positions) {
    const position = account as PositionState;
    const nft = await nftHolder(context, position.nftMint);
    const claimable = state ? getUnClaimLpFee(state, position) : null;
    read.push({
      position: publicKey.toBase58(),
      nftMint: position.nftMint.toBase58(),
      nftAccount: nft?.account ?? null,
      holder: nft?.holder ?? null,
      unlockedLiquidity: big(position.unlockedLiquidity),
      vestedLiquidity: big(position.vestedLiquidity),
      permanentLockedLiquidity: big(position.permanentLockedLiquidity),
      feeAPending: big(position.feeAPending),
      feeBPending: big(position.feeBPending),
      feeAClaimable: claimable ? big(claimable.feeTokenA) : null,
      feeBClaimable: claimable ? big(claimable.feeTokenB) : null,
    });
  }
  return checkLock(dammPool, read);
}

/** Position PDA of a position NFT mint (cp_amm seeds). */
export const positionOf = (nftMint: PublicKey) =>
  derivePositionAddress(nftMint);

/**
 * Build the claim of the LP fees one locked position has earned, for the
 * wallet that holds its NFT (the creator, or RETRY's fee claimer). Claiming
 * fees never touches the locked liquidity. Fees arrive as SOL (the pool
 * collects them in its quote token).
 */
export async function prepareLpFeeClaim(
  context: MeteoraContext,
  input: { owner: PublicKey; launch: PublicKey },
): Promise<{
  tx: Transaction;
  position: LockedPosition;
  expect: TxExpectation;
}> {
  assertWritable(context, "claim-fees");
  await assertCluster(context);
  const launch = await readRetryPool(context, input.launch);
  const { pool, state } = await readDammPool(context, launch.pool);
  const lock = await verifyLockedLiquidity(context, pool, state);
  const position = [...lock.positions, ...lock.others].find(
    (p) => p.holder === input.owner.toBase58() && p.nftAccount,
  );
  if (!position)
    throw new Error("This wallet does not hold an LP position of this token.");
  const address = new PublicKey(pool.address);
  const positionNftAccount = new PublicKey(position.nftAccount!);
  const tx = await dammClient(context).claimPositionFee({
    owner: input.owner,
    position: new PublicKey(position.position),
    pool: address,
    positionNftAccount,
    tokenAMint: state.tokenAMint,
    tokenBMint: WSOL_MINT,
    tokenAVault: state.tokenAVault,
    tokenBVault: state.tokenBVault,
    tokenAProgram: SPL_TOKEN_PROGRAM,
    tokenBProgram: SPL_TOKEN_PROGRAM,
  });
  tx.feePayer = input.owner;
  return {
    tx,
    position,
    expect: {
      owner: input.owner,
      dbc: [],
      damm: ["claim_position_fee"],
      accounts: {
        pool_authority: DAMM_V2_POOL_AUTHORITY,
        pool: address,
        position: new PublicKey(position.position),
        token_a_account: getAssociatedTokenAddressSync(
          state.tokenAMint,
          input.owner,
          true,
        ),
        token_b_account: getAssociatedTokenAddressSync(
          WSOL_MINT,
          input.owner,
          true,
        ),
        token_a_vault: state.tokenAVault,
        token_b_vault: state.tokenBVault,
        token_a_mint: state.tokenAMint,
        token_b_mint: WSOL_MINT,
        position_nft_account: positionNftAccount,
        signer: input.owner,
        token_a_program: SPL_TOKEN_PROGRAM,
        token_b_program: SPL_TOKEN_PROGRAM,
        event_authority: DAMM_V2_EVENT_AUTHORITY,
        program: DAMM_V2_PROGRAM,
      },
      ataMints: [state.tokenAMint, WSOL_MINT],
    },
  };
}

/** A wallet's LP position in a graduated RETRY pool. */
export interface WalletLpPosition {
  dbcPool: string;
  dammPool: string;
  position: string;
  nftAccount: string;
  permanentLockedLiquidity: bigint;
  unlockedLiquidity: bigint;
  vestedLiquidity: bigint;
  /** SOL claimable now, in lamports (the pools collect fees in SOL). */
  feeBClaimable: bigint;
  /** The position's share of its pool's liquidity, percent. */
  sharePct: string;
}

/**
 * The LP positions a wallet holds in graduated RETRY pools: its Token-2022
 * position NFTs (amount 1), their position accounts, and each pool read and
 * checked against its launch. Positions in any other pool are left out.
 */
export async function listLpPositions(
  context: MeteoraContext,
  owner: PublicKey,
  launches: RetryPool[],
): Promise<WalletLpPosition[]> {
  const byPool = new Map(
    launches
      .filter((launch) => launch.status === "graduated" && launch.dammV2Pool)
      .map((launch) => [launch.dammV2Pool!, launch]),
  );
  if (!byPool.size) return [];
  const held = (await dammClient(context).getPositionsByUser(owner)).filter(
    (p) => byPool.has(p.positionState.pool.toBase58()),
  );
  const pools = new Map<string, { pool: DammPool; state: PoolState }>();
  for (const address of new Set(
    held.map((p) => p.positionState.pool.toBase58()),
  ))
    pools.set(address, await readDammPool(context, byPool.get(address)!));
  return held.map(({ position, positionNftAccount, positionState }) => {
    const dammPool = positionState.pool.toBase58();
    const { pool, state } = pools.get(dammPool)!;
    const liquidity =
      big(positionState.permanentLockedLiquidity) +
      big(positionState.unlockedLiquidity) +
      big(positionState.vestedLiquidity);
    return {
      dbcPool: byPool.get(dammPool)!.address,
      dammPool,
      position: position.toBase58(),
      nftAccount: positionNftAccount.toBase58(),
      permanentLockedLiquidity: big(positionState.permanentLockedLiquidity),
      unlockedLiquidity: big(positionState.unlockedLiquidity),
      vestedLiquidity: big(positionState.vestedLiquidity),
      feeBClaimable: big(getUnClaimLpFee(state, positionState).feeTokenB),
      sharePct:
        pool.liquidity > 0n
          ? new Decimal(liquidity.toString())
              .div(pool.liquidity.toString())
              .mul(100)
              .toDecimalPlaces(4, Decimal.ROUND_DOWN)
              .toString()
          : "0",
    };
  });
}
