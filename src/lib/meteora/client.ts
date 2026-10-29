import { Connection, PublicKey } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "./sdk";
import {
  CLUSTERS,
  type SolanaCluster,
  type SolanaConfig,
} from "@/config/solana";
import {
  featureBlock,
  POLICY_MESSAGES,
  RETRY_DBC_CONFIGS,
  type RetryFeature,
} from "@/config/retry-protocol";
import { assertSdkProgramIds } from "./programs";

/**
 * Everything a Meteora operation needs, derived from the one SolanaConfig
 * the wallet provider holds (cluster + RPC). There is no second source of
 * cluster or RPC state.
 */
export interface MeteoraContext {
  cluster: SolanaCluster;
  connection: Connection;
  client: DynamicBondingCurveClient;
  /** RETRY DBC config key for this cluster, or null when none is deployed. */
  retryConfig: PublicKey | null;
  /**
   * Fee claimer the config must pay (RETRY's treasury on Mainnet), from the
   * same reviewed entry. Null when a script or test brings its own config.
   */
  feeClaimer: PublicKey | null;
  /** Genesis hash the RPC must answer before any write. */
  genesis: string;
}

const contexts = new Map<string, MeteoraContext>();

export function meteoraContext(config: SolanaConfig): MeteoraContext {
  const key = `${config.cluster}:${config.rpcUrl}`;
  let context = contexts.get(key);
  if (!context) {
    assertSdkProgramIds();
    const connection = new Connection(config.rpcUrl, {
      commitment: "confirmed",
      disableRetryOnRateLimit: true,
    });
    const retry = RETRY_DBC_CONFIGS[config.cluster];
    context = {
      cluster: config.cluster,
      connection,
      client: new DynamicBondingCurveClient(connection, "confirmed"),
      retryConfig: retry ? new PublicKey(retry.address) : null,
      feeClaimer: retry ? new PublicKey(retry.feeClaimer) : null,
      genesis: CLUSTERS[config.cluster].genesis,
    };
    contexts.set(key, context);
  }
  return context;
}

/** Context for scripts and tests that run against a local validator. */
export function customContext(
  connection: Connection,
  retryConfig: PublicKey | null,
  genesis: string,
  cluster: SolanaCluster = "devnet",
  feeClaimer: PublicKey | null = null,
): MeteoraContext {
  assertSdkProgramIds();
  return {
    cluster,
    connection,
    client: new DynamicBondingCurveClient(connection, "confirmed"),
    retryConfig,
    feeClaimer,
    genesis,
  };
}

const verified = new WeakMap<Connection, number>();
/** Refuse to build or send a transaction if the RPC serves another cluster. */
export async function assertCluster(context: MeteoraContext) {
  if ((verified.get(context.connection) ?? 0) > Date.now()) return;
  const genesis = await context.connection.getGenesisHash();
  if (genesis !== context.genesis)
    throw new Error("RPC cluster does not match the selected environment.");
  verified.set(context.connection, Date.now() + 60_000);
}

/**
 * Writes need a RETRY config on the cluster and the feature switched on,
 * and Mainnet stays locked. Checked again here, not only in the UI.
 */
export function assertWritable(
  context: MeteoraContext,
  feature: RetryFeature,
): PublicKey {
  const blocked = featureBlock(context.cluster, feature);
  if (blocked === "mainnet-locked")
    throw new Error("Mainnet execution is locked.");
  if (blocked) throw new Error(POLICY_MESSAGES[blocked]);
  // The config key comes from the context: the app's per-cluster entry, or
  // the one a script or test created (customContext).
  if (!context.retryConfig)
    throw new Error("The RETRY launch configuration is not deployed.");
  return context.retryConfig;
}
