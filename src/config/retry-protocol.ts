import type { SolanaCluster } from "./solana";

/**
 * The one RETRY launch configuration (Meteora DBC config key) per cluster.
 * Every RETRY launch is a DBC pool created from this config, so the config
 * key is what identifies a RETRY token on-chain. Keys never cross clusters.
 *
 * The parameters behind the key are in `src/lib/meteora/curve.ts`
 * (RETRY_LAUNCH) and are re-checked against the on-chain account before a
 * transaction is built.
 */
export interface RetryDbcConfig {
  /** DBC PoolConfig account. */
  address: string;
  /** Partner fee claimer and leftover receiver written in the config. */
  feeClaimer: string;
  /** Transaction that created the config, for the audit trail. */
  createdBy: string;
  createdAt: string;
  /** Test keys hold no funds worth claiming; production needs a treasury. */
  feeClaimerKind: "ephemeral-test-key" | "treasury";
}

export const RETRY_DBC_CONFIGS: Record<SolanaCluster, RetryDbcConfig | null> = {
  devnet: null,
  // Mainnet stays empty until the owner approves the economics, the fee
  // claimer (treasury) and the security review. See
  // docs/meteora-mvp/MAINNET_RELEASE_CHECKLIST.md.
  "mainnet-beta": null,
};

/**
 * Feature flag for financial execution on Mainnet. It is a constant on
 * purpose: no environment variable or URL can turn it on, only a reviewed
 * code change after explicit owner approval.
 */
export const MAINNET_EXECUTION_ENABLED = false;

/** The owner's sign-off on one exact set of Mainnet parameters. */
export interface MainnetApproval {
  /** SHA-256 printed on docs/meteora-mvp/MAINNET_APPROVAL.md. */
  parametersSha256: string;
  approvedBy: string;
  /** ISO date. */
  approvedAt: string;
  /** Where the owner gave it: a PR review or message link. */
  reference: string;
}

/**
 * Recorded in a reviewed PR once the owner approves the parameter sheet.
 * tests/mainnet-approval.test.ts refuses Mainnet execution unless this
 * matches the parameters the code would use, so changing any of them after
 * the approval locks Mainnet again until it is approved anew.
 */
export const MAINNET_APPROVAL: MainnetApproval | null = null;

/**
 * What RETRY can do, one switch per capability. Reading on-chain state is
 * always on; every capability that signs a transaction is listed here.
 */
export const RETRY_FEATURES = [
  "create",
  "trade-curve",
  "graduate",
  "trade-damm",
  "claim-fees",
] as const;
export type RetryFeature = (typeof RETRY_FEATURES)[number];

/**
 * Reviewed defaults per cluster. Mainnet is off for everything and also
 * behind MAINNET_EXECUTION_ENABLED; turning it on is a code change.
 */
export const FEATURE_DEFAULTS: Record<
  SolanaCluster,
  Record<RetryFeature, boolean>
> = {
  devnet: {
    create: true,
    "trade-curve": true,
    graduate: true,
    "trade-damm": true,
    "claim-fees": true,
  },
  "mainnet-beta": {
    create: false,
    "trade-curve": false,
    graduate: false,
    "trade-damm": false,
    "claim-fees": false,
  },
};

/**
 * An emergency stop for a deployed build: a comma-separated list of features
 * to switch off, e.g. NEXT_PUBLIC_RETRY_DISABLED_FEATURES="trade-damm".
 * It can only turn things off. Unset, empty or unknown names change nothing.
 */
export function disabledFeatures(
  value = process.env.NEXT_PUBLIC_RETRY_DISABLED_FEATURES,
): ReadonlySet<RetryFeature> {
  const names = (value ?? "").split(",").map((name) => name.trim());
  return new Set(
    RETRY_FEATURES.filter(
      (feature) => names.includes(feature) || names.includes("all"),
    ),
  );
}

interface PolicyInputs {
  configs?: Record<SolanaCluster, RetryDbcConfig | null>;
  mainnetEnabled?: boolean;
  defaults?: Record<SolanaCluster, Record<RetryFeature, boolean>>;
  disabled?: ReadonlySet<RetryFeature>;
}

/** Whether a feature may run on a cluster, before any config is looked at. */
export function featureBlock(
  cluster: SolanaCluster,
  feature: RetryFeature | undefined,
  {
    mainnetEnabled = MAINNET_EXECUTION_ENABLED,
    defaults = FEATURE_DEFAULTS,
    disabled = disabledFeatures(),
  }: PolicyInputs = {},
): "mainnet-locked" | "feature-off" | null {
  if (cluster === "mainnet-beta" && !mainnetEnabled) return "mainnet-locked";
  if (feature && (!defaults[cluster][feature] || disabled.has(feature)))
    return "feature-off";
  return null;
}

export type ExecutionPolicy =
  | { enabled: true; cluster: SolanaCluster; config: RetryDbcConfig }
  | {
      enabled: false;
      cluster: SolanaCluster;
      reason: "mainnet-locked" | "config-missing" | "feature-off";
    };

export function executionPolicy(
  cluster: SolanaCluster,
  feature?: RetryFeature,
  inputs: PolicyInputs = {},
): ExecutionPolicy {
  const blocked = featureBlock(cluster, feature, inputs);
  if (blocked) return { enabled: false, cluster, reason: blocked };
  const config = (inputs.configs ?? RETRY_DBC_CONFIGS)[cluster];
  if (!config) return { enabled: false, cluster, reason: "config-missing" };
  return { enabled: true, cluster, config };
}

export const POLICY_MESSAGES = {
  "mainnet-locked":
    "Launching and trading on Solana Mainnet are locked until the RETRY economics and security review are approved. Switch to Devnet to test with free test SOL.",
  "config-missing":
    "The RETRY launch configuration is not deployed on this cluster yet.",
  "feature-off": "This action is switched off on this site for now.",
} as const;
