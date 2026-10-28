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
  // docs/meteora/MAINNET_DEPLOYMENT_CHECKLIST.md.
  "mainnet-beta": null,
};

/**
 * Feature flag for financial execution on Mainnet. It is a constant on
 * purpose: no environment variable or URL can turn it on, only a reviewed
 * code change after explicit owner approval.
 */
export const MAINNET_EXECUTION_ENABLED = false;

export type ExecutionPolicy =
  | { enabled: true; cluster: SolanaCluster; config: RetryDbcConfig }
  | {
      enabled: false;
      cluster: SolanaCluster;
      reason: "mainnet-locked" | "config-missing";
    };

export function executionPolicy(
  cluster: SolanaCluster,
  configs = RETRY_DBC_CONFIGS,
  mainnetEnabled = MAINNET_EXECUTION_ENABLED,
): ExecutionPolicy {
  if (cluster === "mainnet-beta" && !mainnetEnabled)
    return { enabled: false, cluster, reason: "mainnet-locked" };
  const config = configs[cluster];
  if (!config) return { enabled: false, cluster, reason: "config-missing" };
  return { enabled: true, cluster, config };
}

export const POLICY_MESSAGES = {
  "mainnet-locked":
    "Launching and trading on Solana Mainnet are locked until the RETRY economics and security review are approved. Switch to Devnet to test with free test SOL.",
  "config-missing":
    "The RETRY launch configuration is not deployed on this cluster yet.",
} as const;
