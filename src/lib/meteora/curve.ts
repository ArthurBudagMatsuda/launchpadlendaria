import BN from "bn.js";
import {
  ActivationType,
  BaseFeeMode,
  buildCurve,
  CollectFeeMode,
  getPriceFromSqrtPrice,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  type BuildCurveParams,
  type ConfigParameters,
  type PoolConfig,
} from "./sdk";

/**
 * RETRY launch parameters (Devnet candidate, not approved for Mainnet).
 * Every value is documented with its reason in
 * docs/meteora/METEORA_DBC_CONFIGURATION.md. Change them only together with
 * that document and a new config key: an existing DBC config is immutable.
 */
export const RETRY_LAUNCH = {
  totalSupply: 1_000_000_000,
  decimals: 9,
  /** Constant trading fee on the curve, in basis points. */
  tradingFeeBps: 100,
  /** Share of the partner+creator part of the fee paid to the creator. */
  creatorTradingFeePercent: 50,
  /** SOL in the curve that completes it (Meteora keeper minimum for SOL). */
  migrationQuoteThresholdSol: 10,
  /** Supply deposited with the SOL into DAMM v2 at graduation. */
  percentageSupplyOnMigration: 20,
  /** DAMM v2 LP fee after graduation (FixedBps100 = 1%). */
  migrationFeeOption: MigrationFeeOption.FixedBps100,
  /** Share of graduated liquidity locked forever, per owner. */
  partnerPermanentLockedLiquidityPercent: 50,
  creatorPermanentLockedLiquidityPercent: 50,
} as const;

export function retryCurveParams(): BuildCurveParams {
  return {
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.NINE,
      tokenQuoteDecimal: 9,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: RETRY_LAUNCH.totalSupply,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: RETRY_LAUNCH.tradingFeeBps,
          endingFeeBps: RETRY_LAUNCH.tradingFeeBps,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: RETRY_LAUNCH.creatorTradingFeePercent,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: RETRY_LAUNCH.migrationFeeOption,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: {
      partnerLiquidityPercentage: 0,
      partnerPermanentLockedLiquidityPercentage:
        RETRY_LAUNCH.partnerPermanentLockedLiquidityPercent,
      creatorLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage:
        RETRY_LAUNCH.creatorPermanentLockedLiquidityPercent,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    percentageSupplyOnMigration: RETRY_LAUNCH.percentageSupplyOnMigration,
    migrationQuoteThreshold: RETRY_LAUNCH.migrationQuoteThresholdSol,
  };
}

let cached: ConfigParameters | undefined;
/** The SDK-built curve for RETRY_LAUNCH. Pure and deterministic. */
export function retryCurve(): ConfigParameters {
  cached ??= buildCurve(retryCurveParams());
  return cached;
}

const bn = (value: BN | number) => new BN(value).toString();

/**
 * Compare the on-chain config with what RETRY_LAUNCH builds. Any difference
 * means the account is not the RETRY config this code was reviewed for.
 * Returns the names of the fields that differ (empty when it matches).
 */
export function configMismatches(
  onchain: PoolConfig,
  expected = retryCurve(),
): string[] {
  const checks: [string, string, string][] = [
    ["tokenType", bn(onchain.tokenType), bn(expected.tokenType)],
    ["tokenDecimal", bn(onchain.tokenDecimal), bn(expected.tokenDecimal)],
    [
      "tokenUpdateAuthority",
      bn(onchain.tokenUpdateAuthority),
      bn(expected.tokenUpdateAuthority),
    ],
    [
      "migrationOption",
      bn(onchain.migrationOption),
      bn(expected.migrationOption),
    ],
    [
      "migrationFeeOption",
      bn(onchain.migrationFeeOption),
      bn(expected.migrationFeeOption),
    ],
    [
      "migrationQuoteThreshold",
      bn(onchain.migrationQuoteThreshold),
      bn(expected.migrationQuoteThreshold),
    ],
    ["sqrtStartPrice", bn(onchain.sqrtStartPrice), bn(expected.sqrtStartPrice)],
    [
      "cliffFeeNumerator",
      bn(onchain.poolFees.baseFee.cliffFeeNumerator),
      bn(expected.poolFees.baseFee.cliffFeeNumerator),
    ],
    [
      "dynamicFee",
      bn(onchain.poolFees.dynamicFee.initialized),
      expected.poolFees.dynamicFee ? "1" : "0",
    ],
    ["collectFeeMode", bn(onchain.collectFeeMode), bn(expected.collectFeeMode)],
    [
      "creatorTradingFeePercentage",
      bn(onchain.creatorTradingFeePercentage),
      bn(expected.creatorTradingFeePercentage),
    ],
    [
      "poolCreationFee",
      bn(onchain.poolCreationFee),
      bn(expected.poolCreationFee),
    ],
    [
      "migrationFeePercentage",
      bn(onchain.migrationFeePercentage),
      bn(expected.migrationFee.feePercentage),
    ],
    [
      "partnerLiquidityPercentage",
      bn(onchain.partnerLiquidityPercentage),
      bn(expected.partnerLiquidityPercentage),
    ],
    [
      "creatorLiquidityPercentage",
      bn(onchain.creatorLiquidityPercentage),
      bn(expected.creatorLiquidityPercentage),
    ],
    [
      "partnerPermanentLockedLiquidityPercentage",
      bn(onchain.partnerPermanentLockedLiquidityPercentage),
      bn(expected.partnerPermanentLockedLiquidityPercentage),
    ],
    [
      "creatorPermanentLockedLiquidityPercentage",
      bn(onchain.creatorPermanentLockedLiquidityPercentage),
      bn(expected.creatorPermanentLockedLiquidityPercentage),
    ],
    ["transferFeeFlag", bn(onchain.transferFeeFlag), "0"],
    [
      "preMigrationTokenSupply",
      bn(onchain.preMigrationTokenSupply),
      bn(expected.tokenSupply?.preMigrationTokenSupply ?? 0),
    ],
    [
      "postMigrationTokenSupply",
      bn(onchain.postMigrationTokenSupply),
      bn(expected.tokenSupply?.postMigrationTokenSupply ?? 0),
    ],
  ];
  const mismatches = checks
    .filter(([, actual, wanted]) => actual !== wanted)
    .map(([name]) => name);
  const live = onchain.curve.filter(
    (point) => !new BN(point.sqrtPrice).isZero(),
  );
  if (
    live.length !== expected.curve.length ||
    live.some(
      (point, i) =>
        bn(point.sqrtPrice) !== bn(expected.curve[i].sqrtPrice) ||
        bn(point.liquidity) !== bn(expected.curve[i].liquidity),
    )
  )
    mismatches.push("curve");
  return mismatches;
}

/** Display figures for the RETRY curve, all in SOL (decimal strings). */
export function curveSummary(config = retryCurve()) {
  const start = getPriceFromSqrtPrice(config.sqrtStartPrice, 9, 9);
  const end = getPriceFromSqrtPrice(
    config.curve[config.curve.length - 1].sqrtPrice,
    9,
    9,
  );
  return {
    startPriceSol: start.toSignificantDigits(6).toString(),
    startFdvSol: start
      .mul(RETRY_LAUNCH.totalSupply)
      .toDecimalPlaces(3)
      .toString(),
    graduationPriceSol: end.toSignificantDigits(6).toString(),
    graduationFdvSol: end
      .mul(RETRY_LAUNCH.totalSupply)
      .toDecimalPlaces(3)
      .toString(),
    thresholdLamports: BigInt(config.migrationQuoteThreshold.toString()),
  };
}
