import type { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { deriveDammV2PoolAddress } from "./sdk";
import { assertCluster, assertWritable, type MeteoraContext } from "./client";
import { RETRY_LAUNCH } from "./curve";
import { MIGRATION_PROGRESS, readRetryPool, type RetryPool } from "./pools";
import { DAMM_V2_PROGRAM, dammV2ConfigFor, WSOL_MINT } from "./programs";
import type { TxExpectation } from "./transactions";

/** What the graduation panel shows. Every figure comes from pool state. */
export interface GraduationView {
  status: RetryPool["status"];
  progressBps: number;
  /** SOL still needed in the curve before it completes, in lamports. */
  remainingLamports: bigint;
  thresholdLamports: bigint;
  /** Whether anyone can submit the migration now (permissionless). */
  canMigrate: boolean;
  /** Mainnet has Meteora's keeper; on Devnet migration is manual. */
  keeper: "meteora-mainnet" | "manual";
  dammV2Pool: string | null;
  /** Share of the graduated LP locked forever, per owner (percent). */
  lockedLiquidity: { partner: number; creator: number };
}

export function graduationView(pool: RetryPool): GraduationView {
  const remaining = pool.migrationQuoteThreshold - pool.quoteReserve;
  return {
    status: pool.status,
    progressBps: pool.progressBps,
    remainingLamports: remaining > 0n ? remaining : 0n,
    thresholdLamports: pool.migrationQuoteThreshold,
    canMigrate:
      !pool.isMigrated &&
      pool.quoteReserve >= pool.migrationQuoteThreshold &&
      pool.migrationProgress === MIGRATION_PROGRESS.lockedVesting,
    keeper: pool.cluster === "mainnet-beta" ? "meteora-mainnet" : "manual",
    dammV2Pool: pool.dammV2Pool,
    lockedLiquidity: {
      partner: RETRY_LAUNCH.partnerPermanentLockedLiquidityPercent,
      creator: RETRY_LAUNCH.creatorPermanentLockedLiquidityPercent,
    },
  };
}

export interface PreparedMigration {
  tx: Transaction;
  /** Fresh mints of the two DAMM v2 position NFTs (partner, creator). */
  signers: Keypair[];
  dammV2Pool: PublicKey;
  expect: TxExpectation;
}

/**
 * Build the permissionless DBC → DAMM v2 migration for a completed RETRY
 * pool. The payer only pays rent and fees: the LP positions belong to the
 * config's fee claimer and the pool creator, and the program locks them.
 */
export async function prepareMigration(
  context: MeteoraContext,
  input: { payer: PublicKey; pool: PublicKey },
): Promise<PreparedMigration> {
  assertWritable(context);
  await assertCluster(context);
  const read = await readRetryPool(context, input.pool);
  const view = graduationView(read.pool);
  if (!view.canMigrate)
    throw new Error(
      read.pool.isMigrated
        ? "This token already graduated."
        : "The curve is not complete yet.",
    );
  const dammConfig = dammV2ConfigFor(read.config.migrationFeeOption);
  // The program validates the DAMM v2 config by content, not by address:
  // check it is the public cp_amm config with the fee RETRY expects.
  const configInfo = await context.connection.getAccountInfo(
    dammConfig,
    "confirmed",
  );
  if (!configInfo?.owner.equals(DAMM_V2_PROGRAM))
    throw new Error("The DAMM v2 migration config is missing on this cluster.");
  const { transaction, firstPositionNftKeypair, secondPositionNftKeypair } =
    await context.client.migration.migrateToDammV2({
      payer: input.payer,
      pool: input.pool,
      dammConfig,
    });
  transaction.feePayer = input.payer;
  const mint = read.raw.poolState.baseMint;
  const dammV2Pool = deriveDammV2PoolAddress(dammConfig, mint, WSOL_MINT);
  return {
    tx: transaction,
    signers: [firstPositionNftKeypair, secondPositionNftKeypair],
    dammV2Pool,
    expect: {
      owner: input.payer,
      dbc: ["migration_damm_v2"],
      accounts: {
        virtual_pool: input.pool,
        config: read.raw.poolState.config,
        pool: dammV2Pool,
        amm_program: DAMM_V2_PROGRAM,
        base_mint: mint,
        quote_mint: WSOL_MINT,
        base_vault: read.raw.poolState.baseVault,
        quote_vault: read.raw.poolState.quoteVault,
        payer: input.payer,
        first_position_nft_mint: firstPositionNftKeypair.publicKey,
        second_position_nft_mint: secondPositionNftKeypair.publicKey,
      },
      ataMints: [],
      extraSigners: [
        firstPositionNftKeypair.publicKey,
        secondPositionNftKeypair.publicKey,
      ],
    },
  };
}

/** The graduated pool's LP fee, in basis points, for display. */
export function graduatedFeeBps() {
  return (
    { 0: 25, 1: 30, 2: 100, 3: 200, 4: 400, 5: 600 } as Record<number, number>
  )[RETRY_LAUNCH.migrationFeeOption];
}
