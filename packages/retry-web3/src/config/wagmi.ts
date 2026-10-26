import {
  type Config,
  type CreateConnectorFn,
  cookieStorage,
  cookieToInitialState,
  createConfig,
  createStorage,
  noopStorage,
  type State,
  type Transport,
} from 'wagmi'
import { redactUrl } from '../lib/logger.js'
import {
  RETRY_NETWORKS,
  type RetryChain,
  type RetryNetworkEnvironment,
  type RetrySupportedChainId,
  SUPPORTED_CHAIN_IDS,
} from './chains.js'
import { createRetryConnectors, DEFAULT_RETRY_APP_METADATA, type RetryAppMetadata } from './connectors.js'
import { parseRetryWeb3Env, type RetryWeb3Env, type RetryWeb3EnvInput } from './env.js'
import {
  createRetryTransports,
  planRpcEndpoints,
  type RetryTransportOptions,
  type RpcEndpointKind,
} from './transports.js'

/**
 * Hard switch for anything that moves funds. Stage 2 ships read-only wallet
 * infrastructure only: no transactions, signatures, approvals or swaps.
 */
export const RETRY_FINANCIAL_OPERATIONS_ENABLED = false as const

export const RETRY_STORAGE_KEY = 'retry.wagmi'

/** wagmi config created by {@link createRetryWeb3Config}. Chains: Base and Base Sepolia. */
export type RetryWagmiConfig = Config

export interface RetryWeb3Settings {
  /** Network the app asks users to be on (Base Sepolia in development). */
  targetChainId: RetrySupportedChainId
  supportedChainIds: readonly RetrySupportedChainId[]
  environment: RetryNetworkEnvironment
  app: RetryAppMetadata
  walletConnectEnabled: boolean
  /** RPC endpoints per chain with credentials stripped (origin only). */
  rpc: Record<RetrySupportedChainId, { kind: RpcEndpointKind; origin: string }[]>
  warnings: readonly string[]
  balanceRefreshIntervalMs: number
  financialOperationsEnabled: typeof RETRY_FINANCIAL_OPERATIONS_ENABLED
}

export interface RetryWeb3Config {
  wagmiConfig: RetryWagmiConfig
  settings: RetryWeb3Settings
}

export type RetryStorageMode = 'cookie' | 'local' | 'none'

export interface CreateRetryWeb3ConfigOptions {
  /** Raw environment values, or an already parsed {@link RetryWeb3Env}. */
  env?: RetryWeb3EnvInput | RetryWeb3Env | undefined
  app?: Partial<RetryAppMetadata> | undefined
  /** Set to `true` in Next.js (App Router / SSR). Enables cookie persistence by default. */
  ssr?: boolean | undefined
  /** Where wagmi persists the last connection (never keys or secrets). */
  storage?: RetryStorageMode | undefined
  transport?: RetryTransportOptions | undefined
  /** Balance polling interval. Default 30s; polling pauses while the tab is hidden. */
  balanceRefreshIntervalMs?: number | undefined
  /** Testing hooks: replace connectors or transports entirely. */
  connectors?: CreateConnectorFn[] | undefined
  transports?: Partial<Record<RetrySupportedChainId, Transport>> | undefined
  /** Set to `false` to disable EIP-6963 wallet discovery. Default true. */
  multiInjectedProviderDiscovery?: boolean | undefined
}

export const DEFAULT_BALANCE_REFRESH_INTERVAL_MS = 30_000

function isParsedEnv(env: RetryWeb3EnvInput | RetryWeb3Env): env is RetryWeb3Env {
  return 'defaultChainId' in env && 'rpcUrls' in env
}

function createStorageFor(mode: RetryStorageMode) {
  if (mode === 'none') return null
  if (mode === 'cookie') return createStorage({ storage: cookieStorage, key: RETRY_STORAGE_KEY })
  const local = typeof window !== 'undefined' ? window.localStorage : noopStorage
  return createStorage({ storage: local, key: RETRY_STORAGE_KEY })
}

/**
 * Single source of Web3 configuration for RETRY: chains, transports,
 * connectors and persistence. Create it once per app (module scope or
 * `useState(() => createRetryWeb3Config(...))`) and pass it to
 * `RetryWeb3Provider`.
 */
export function createRetryWeb3Config(options: CreateRetryWeb3ConfigOptions = {}): RetryWeb3Config {
  const env = options.env && isParsedEnv(options.env) ? options.env : parseRetryWeb3Env(options.env)
  const app: RetryAppMetadata = { ...DEFAULT_RETRY_APP_METADATA, ...options.app }
  const ssr = options.ssr ?? false
  const storageMode = options.storage ?? (ssr ? 'cookie' : 'local')

  const targetChainId = env.defaultChainId
  const targetChain = RETRY_NETWORKS[targetChainId].chain
  const otherChains = SUPPORTED_CHAIN_IDS.filter((id) => id !== targetChainId).map(
    (id) => RETRY_NETWORKS[id].chain,
  )
  // The first chain is wagmi's default; keep the target network first.
  const chains: readonly [RetryChain, ...RetryChain[]] = [targetChain, ...otherChains]

  const transports = {
    ...createRetryTransports(env.rpcUrls, options.transport),
    ...options.transports,
  } as Record<RetrySupportedChainId, Transport>

  const connectors =
    options.connectors ?? createRetryConnectors({ app, walletConnectProjectId: env.walletConnectProjectId })

  const wagmiConfig = createConfig({
    chains,
    transports,
    connectors,
    ssr,
    storage: createStorageFor(storageMode),
    multiInjectedProviderDiscovery: options.multiInjectedProviderDiscovery ?? true,
    batch: { multicall: true },
  }) as RetryWagmiConfig

  const plans = planRpcEndpoints(env.rpcUrls, options.transport)
  const rpc = Object.fromEntries(
    SUPPORTED_CHAIN_IDS.map((id) => [
      id,
      plans[id].endpoints.map(({ kind, url }) => ({ kind, origin: redactUrl(url) })),
    ]),
  ) as RetryWeb3Settings['rpc']

  const walletConnectEnabled = wagmiConfig.connectors.some((connector) => connector.type === 'walletConnect')

  return {
    wagmiConfig,
    settings: {
      targetChainId,
      supportedChainIds: SUPPORTED_CHAIN_IDS,
      environment: RETRY_NETWORKS[targetChainId].environment,
      app,
      walletConnectEnabled,
      rpc,
      warnings: env.warnings,
      balanceRefreshIntervalMs: options.balanceRefreshIntervalMs ?? DEFAULT_BALANCE_REFRESH_INTERVAL_MS,
      financialOperationsEnabled: RETRY_FINANCIAL_OPERATIONS_ENABLED,
    },
  }
}

/**
 * Server helper for Next.js: turns the request cookie into wagmi's initial
 * state so the first client render matches the server render (no hydration
 * mismatch). Requires `ssr: true` (cookie storage).
 */
export function getRetryInitialState(
  config: RetryWeb3Config,
  cookieHeader: string | null | undefined,
): State | undefined {
  return cookieToInitialState(config.wagmiConfig, cookieHeader)
}
