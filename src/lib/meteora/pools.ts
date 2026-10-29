import BN from "bn.js";
import { PublicKey, type AccountInfo } from "@solana/web3.js";
import {
  deriveDammV2PoolAddress,
  deriveDbcPoolAddress,
  getPriceFromSqrtPrice,
  type PoolConfig,
  type VirtualPool,
} from "./sdk";
import type { MeteoraContext } from "./client";
import { configMismatches, RETRY_LAUNCH } from "./curve";
import {
  DAMM_V2_PROGRAM,
  DBC_PROGRAM,
  dammV2ConfigFor,
  SPL_TOKEN_PROGRAM,
  WSOL_MINT,
} from "./programs";

export type LaunchStatus =
  | "active"
  | "near-graduation"
  | "graduation-ready"
  | "migrating"
  | "graduated"
  | "needs-attention";

/** DBC MigrationProgress (state/virtual_pool.rs). */
export const MIGRATION_PROGRESS = {
  preBondingCurve: 0,
  postBondingCurve: 1,
  lockedVesting: 2,
  createdPool: 3,
} as const;

/** Progress at or above this (in basis points) shows as near graduation. */
export const NEAR_GRADUATION_BPS = 8_000;

/** A RETRY launch, read from its DBC accounts. Amounts are raw units. */
export interface RetryPool {
  cluster: MeteoraContext["cluster"];
  address: string;
  config: string;
  creator: string;
  baseMint: string;
  baseVault: string;
  quoteVault: string;
  baseReserve: bigint;
  quoteReserve: bigint;
  sqrtPrice: bigint;
  migrationQuoteThreshold: bigint;
  /** quoteReserve / threshold in basis points, capped at 10 000. */
  progressBps: number;
  /** Spot price in SOL per whole token (display only, from sqrtPrice). */
  priceSol: string;
  /** Spot price × fixed total supply, in SOL. FDV, not market cap. */
  fdvSol: string;
  totalSupply: bigint;
  isMigrated: boolean;
  migrationProgress: number;
  finishCurveTimestamp: number;
  activationPoint: bigint;
  /** Unclaimed fees held by the pool for the creator and the partner. */
  creatorQuoteFee: bigint;
  partnerQuoteFee: bigint;
  /** Cumulative trading fees charged in SOL (not volume). */
  totalTradingQuoteFee: bigint;
  dammV2Config: string;
  /** DAMM v2 pool the migration creates; present once it exists on-chain. */
  dammV2Pool: string | null;
  status: LaunchStatus;
  /** Slot of the RPC context the accounts were read at. */
  slot: number;
}

const big = (value: BN | number) => BigInt(new BN(value).toString());

export class PoolValidationError extends Error {}

export function decodeConfig(
  context: MeteoraContext,
  info: AccountInfo<Buffer> | null,
): PoolConfig {
  if (!info) throw new PoolValidationError("Config account not found.");
  if (!info.owner.equals(DBC_PROGRAM))
    throw new PoolValidationError("Config is not owned by Meteora DBC.");
  return context.client.program.coder.accounts.decode<PoolConfig>(
    "poolConfig",
    info.data,
  );
}

export function decodePool(
  context: MeteoraContext,
  info: AccountInfo<Buffer> | null,
): VirtualPool {
  if (!info) throw new PoolValidationError("Pool account not found.");
  // The SDK only checks the discriminator; an account another program owns
  // can carry the same bytes, so ownership is checked first.
  if (!info.owner.equals(DBC_PROGRAM))
    throw new PoolValidationError("Pool is not owned by Meteora DBC.");
  return context.client.program.coder.accounts.decode<VirtualPool>(
    "virtualPool",
    info.data,
  );
}

/**
 * Every check that makes a DBC pool a RETRY launch: owned by DBC, created
 * from the RETRY config of this cluster, quoted in WSOL, SPL Token base mint
 * at the pool's canonical address. Throws PoolValidationError otherwise.
 */
export function validateRetryPool(
  context: MeteoraContext,
  address: PublicKey,
  pool: VirtualPool,
  config: PoolConfig,
) {
  const state = pool.poolState;
  if (!context.retryConfig || !state.config.equals(context.retryConfig))
    throw new PoolValidationError(
      "Pool was not created from the RETRY config.",
    );
  if (!config.quoteMint.equals(WSOL_MINT))
    throw new PoolValidationError("Pool is not quoted in SOL.");
  const expected = deriveDbcPoolAddress(
    config.quoteMint,
    state.baseMint,
    state.config,
  );
  if (!expected.equals(address))
    throw new PoolValidationError("Pool address is not the canonical DBC PDA.");
  const mismatches = configMismatches(config);
  if (mismatches.length)
    throw new PoolValidationError(
      `RETRY config differs from the reviewed parameters: ${mismatches.join(", ")}.`,
    );
}

function deriveStatus(
  pool: VirtualPool["poolState"],
  threshold: bigint,
  dammV2Exists: boolean,
): LaunchStatus {
  const complete = big(pool.quoteReserve) >= threshold;
  if (pool.isMigrated === 1)
    return dammV2Exists ? "graduated" : "needs-attention";
  if (complete)
    return pool.migrationProgress === MIGRATION_PROGRESS.lockedVesting
      ? "graduation-ready"
      : "migrating";
  const progress = (big(pool.quoteReserve) * 10_000n) / threshold;
  return progress >= BigInt(NEAR_GRADUATION_BPS) ? "near-graduation" : "active";
}

export function toRetryPool(
  context: MeteoraContext,
  address: PublicKey,
  pool: VirtualPool,
  config: PoolConfig,
  slot: number,
  dammV2Exists: boolean,
): RetryPool {
  const state = pool.poolState;
  const threshold = big(config.migrationQuoteThreshold);
  const totalSupply = big(config.postMigrationTokenSupply);
  const price = getPriceFromSqrtPrice(
    state.sqrtPrice,
    RETRY_LAUNCH.decimals,
    9,
  );
  const dammConfig = dammV2ConfigFor(config.migrationFeeOption);
  const progress = (big(state.quoteReserve) * 10_000n) / threshold;
  return {
    cluster: context.cluster,
    address: address.toBase58(),
    config: state.config.toBase58(),
    creator: state.creator.toBase58(),
    baseMint: state.baseMint.toBase58(),
    baseVault: state.baseVault.toBase58(),
    quoteVault: state.quoteVault.toBase58(),
    baseReserve: big(state.baseReserve),
    quoteReserve: big(state.quoteReserve),
    sqrtPrice: big(state.sqrtPrice),
    migrationQuoteThreshold: threshold,
    progressBps: Number(progress > 10_000n ? 10_000n : progress),
    priceSol: price.toSignificantDigits(6).toString(),
    fdvSol: price
      .mul(totalSupply.toString())
      .div(10 ** RETRY_LAUNCH.decimals)
      .toDecimalPlaces(4)
      .toString(),
    totalSupply,
    isMigrated: state.isMigrated === 1,
    migrationProgress: state.migrationProgress,
    finishCurveTimestamp: Number(big(state.finishCurveTimestamp)),
    activationPoint: big(state.activationPoint),
    creatorQuoteFee: big(state.creatorQuoteFee),
    partnerQuoteFee: big(state.partnerQuoteFee),
    totalTradingQuoteFee: big(state.metrics.totalTradingQuoteFee),
    dammV2Config: dammConfig.toBase58(),
    dammV2Pool: dammV2Exists
      ? deriveDammV2PoolAddress(
          dammConfig,
          state.baseMint,
          config.quoteMint,
        ).toBase58()
      : null,
    status: deriveStatus(state, threshold, dammV2Exists),
    slot,
  };
}

async function dammV2PoolExists(
  context: MeteoraContext,
  pool: VirtualPool,
  config: PoolConfig,
) {
  if (pool.poolState.isMigrated !== 1) return false;
  const address = deriveDammV2PoolAddress(
    dammV2ConfigFor(config.migrationFeeOption),
    pool.poolState.baseMint,
    config.quoteMint,
  );
  const info = await context.connection.getAccountInfo(address, "confirmed");
  return Boolean(info?.owner.equals(DAMM_V2_PROGRAM));
}

/** Read one RETRY pool by its DBC pool address. Throws if it is not one. */
export async function readRetryPool(
  context: MeteoraContext,
  address: PublicKey,
): Promise<{ pool: RetryPool; raw: VirtualPool; config: PoolConfig }> {
  if (!context.retryConfig)
    throw new PoolValidationError("No RETRY config on this cluster.");
  const { context: rpc, value } =
    await context.connection.getMultipleAccountsInfoAndContext(
      [address, context.retryConfig],
      "confirmed",
    );
  const raw = decodePool(context, value[0]);
  const config = decodeConfig(context, value[1]);
  validateRetryPool(context, address, raw, config);
  const exists = await dammV2PoolExists(context, raw, config);
  return {
    pool: toRetryPool(context, address, raw, config, rpc.slot, exists),
    raw,
    config,
  };
}

/** The RETRY pool of a base mint: the PDA of (WSOL, mint, RETRY config). */
export function retryPoolAddress(context: MeteoraContext, mint: PublicKey) {
  if (!context.retryConfig) return null;
  return deriveDbcPoolAddress(WSOL_MINT, mint, context.retryConfig);
}

/**
 * Every pool created from the RETRY config, straight from the DBC program's
 * accounts (getProgramAccounts filtered by config). No indexer.
 */
export async function listRetryPools(
  context: MeteoraContext,
): Promise<RetryPool[]> {
  if (!context.retryConfig) return [];
  const [configInfo, pools, slot] = await Promise.all([
    context.connection.getAccountInfo(context.retryConfig, "confirmed"),
    context.client.state.getPoolsByConfig(context.retryConfig),
    context.connection.getSlot("confirmed"),
  ]);
  const config = decodeConfig(context, configInfo);
  const result: RetryPool[] = [];
  for (const { publicKey, account } of pools) {
    try {
      validateRetryPool(context, publicKey, account, config);
    } catch {
      continue;
    }
    const exists = await dammV2PoolExists(context, account, config);
    result.push(toRetryPool(context, publicKey, account, config, slot, exists));
  }
  return result;
}

/** Base mint program check: RETRY launches are SPL Token mints. */
export async function assertSplMint(context: MeteoraContext, mint: PublicKey) {
  const info = await context.connection.getAccountInfo(mint, "confirmed");
  if (!info) throw new PoolValidationError("Mint not found.");
  if (!info.owner.equals(SPL_TOKEN_PROGRAM))
    throw new PoolValidationError("Mint is not an SPL Token mint.");
}
