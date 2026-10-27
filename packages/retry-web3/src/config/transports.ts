import { fallback, http, type Transport } from 'wagmi'
import {
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  RETRY_NETWORKS,
  type RetrySupportedChainId,
} from './chains.js'

export interface RetryTransportOptions {
  /** Per-request timeout. Default 8s. */
  timeoutMs?: number
  /**
   * Extra attempts after the whole endpoint list failed. viem applies an
   * exponential backoff (`retryDelayMs * 2^attempt`) and only retries
   * transient failures (timeouts, 429, 5xx); user rejections are never retried.
   * Default 2.
   */
  retryCount?: number
  /** Base delay for the exponential backoff. Default 500ms. */
  retryDelayMs?: number
  /** Group concurrent JSON-RPC calls into one HTTP request. Default false. */
  batch?: boolean
  /**
   * Keep the public Base endpoint as a fallback after a custom RPC. Default
   * true. Disable it in production if traffic must never reach the
   * rate-limited public endpoint.
   */
  publicFallback?: boolean
}

export const RETRY_TRANSPORT_DEFAULTS = {
  timeoutMs: 8_000,
  retryCount: 2,
  retryDelayMs: 500,
  batch: false,
  publicFallback: true,
} as const satisfies Required<RetryTransportOptions>

export type RpcEndpointKind = 'custom' | 'public'

export interface RpcEndpointPlan {
  chainId: RetrySupportedChainId
  /** Endpoints in the order they are tried. */
  endpoints: { kind: RpcEndpointKind; url: string }[]
}

/** Pure description of which endpoints each chain will use. Useful for diagnostics and tests. */
export function planRpcEndpoints(
  rpcUrls: Partial<Record<RetrySupportedChainId, string>>,
  options: Pick<RetryTransportOptions, 'publicFallback'> = {},
): Record<RetrySupportedChainId, RpcEndpointPlan> {
  const publicFallback = options.publicFallback ?? RETRY_TRANSPORT_DEFAULTS.publicFallback
  const plan = (chainId: RetrySupportedChainId): RpcEndpointPlan => {
    const custom = rpcUrls[chainId]
    const publicUrl = RETRY_NETWORKS[chainId].publicRpcUrl
    const endpoints: RpcEndpointPlan['endpoints'] = []
    if (custom) endpoints.push({ kind: 'custom', url: custom })
    if (!custom || (publicFallback && custom !== publicUrl)) {
      endpoints.push({ kind: 'public', url: publicUrl })
    }
    return { chainId, endpoints }
  }
  return {
    [BASE_MAINNET_CHAIN_ID]: plan(BASE_MAINNET_CHAIN_ID),
    [BASE_SEPOLIA_CHAIN_ID]: plan(BASE_SEPOLIA_CHAIN_ID),
  }
}

/**
 * Builds the read transports for Base and Base Sepolia. All JSON-RPC reads
 * (balances, contract reads) go through these endpoints, never through the
 * wallet, so a misbehaving wallet cannot spoof on-chain data.
 */
export function createRetryTransports(
  rpcUrls: Partial<Record<RetrySupportedChainId, string>>,
  options: RetryTransportOptions = {},
): Record<RetrySupportedChainId, Transport> {
  const settings = { ...RETRY_TRANSPORT_DEFAULTS, ...options }
  const plans = planRpcEndpoints(rpcUrls, settings)
  const build = (chainId: RetrySupportedChainId): Transport => {
    const transports = plans[chainId].endpoints.map(({ url, kind }) =>
      http(url, {
        key: kind,
        name: kind === 'custom' ? 'Custom RPC' : 'Public Base RPC',
        timeout: settings.timeoutMs,
        batch: settings.batch,
      }),
    )
    return fallback(transports, {
      rank: false,
      retryCount: settings.retryCount,
      retryDelay: settings.retryDelayMs,
    })
  }
  return {
    [BASE_MAINNET_CHAIN_ID]: build(BASE_MAINNET_CHAIN_ID),
    [BASE_SEPOLIA_CHAIN_ID]: build(BASE_SEPOLIA_CHAIN_ID),
  }
}
