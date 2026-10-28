/**
 * Server-safe entry point (`@retry/web3/config`): no React, no hooks.
 * Safe to import from Next.js Server Components, route handlers and scripts.
 */
export {
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  base,
  baseSepolia,
  DEFAULT_RETRY_CHAIN_ID,
  getChainDisplayName,
  getRetryNetwork,
  getRetryNetworkByKey,
  isSupportedChainId,
  parseChainKey,
  RETRY_NETWORKS,
  type RetryChain,
  type RetryChainKey,
  type RetryNetworkEnvironment,
  type RetryNetworkInfo,
  type RetrySupportedChainId,
  SUPPORTED_CHAIN_IDS,
} from './chains.js'
export {
  createRetryConnectors,
  DEFAULT_RETRY_APP_METADATA,
  RETRY_CONNECTOR_IDS,
  type RetryAppMetadata,
  type RetryConnectorsOptions,
} from './connectors.js'
export {
  isValidRpcUrl,
  isValidWalletConnectProjectId,
  parseRetryWeb3Env,
  RETRY_WEB3_ENV_VARS,
  type RetryWeb3Env,
  type RetryWeb3EnvInput,
  readRetryWeb3EnvFromRecord,
} from './env.js'
export { createRetryQueryClient, RETRY_QUERY_DEFAULTS } from './query-client.js'
export {
  createRetryTransports,
  planRpcEndpoints,
  RETRY_TRANSPORT_DEFAULTS,
  type RetryTransportOptions,
  type RpcEndpointKind,
  type RpcEndpointPlan,
} from './transports.js'
export {
  type CreateRetryWeb3ConfigOptions,
  createRetryWeb3Config,
  DEFAULT_BALANCE_REFRESH_INTERVAL_MS,
  getRetryInitialState,
  RETRY_FINANCIAL_OPERATIONS_ENABLED,
  RETRY_STORAGE_KEY,
  type RetryStorageMode,
  type RetryWagmiConfig,
  type RetryWeb3Config,
  type RetryWeb3Settings,
} from './wagmi.js'
