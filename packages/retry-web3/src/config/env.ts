import {
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_RETRY_CHAIN_ID,
  getRetryNetworkByKey,
  parseChainKey,
  type RetrySupportedChainId,
} from './chains.js'

/**
 * Raw, untrusted values coming from the host app's environment.
 *
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` when each variable is read
 * by its full literal name, so the app must pass them explicitly:
 *
 * ```ts
 * parseRetryWeb3Env({
 *   defaultChain: process.env.NEXT_PUBLIC_DEFAULT_NETWORK,
 *   baseMainnetRpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL,
 *   baseSepoliaRpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
 *   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
 * })
 * ```
 */
export interface RetryWeb3EnvInput {
  defaultChain?: string | undefined
  baseMainnetRpcUrl?: string | undefined
  baseSepoliaRpcUrl?: string | undefined
  walletConnectProjectId?: string | undefined
}

export interface RetryWeb3Env {
  /** Network the app targets: Base Sepolia for development, Base for production. */
  defaultChainId: RetrySupportedChainId
  /** Custom RPC endpoints, validated. Missing entries fall back to the public Base RPC. */
  rpcUrls: Partial<Record<RetrySupportedChainId, string>>
  /** `undefined` when not configured or invalid; WalletConnect is then disabled. */
  walletConnectProjectId: string | undefined
  /** Human readable configuration problems. Never contains secret values. */
  warnings: string[]
}

/** Public variable names used by the RETRY Next.js app. */
export const RETRY_WEB3_ENV_VARS = {
  defaultChain: 'NEXT_PUBLIC_DEFAULT_NETWORK',
  baseMainnetRpcUrl: 'NEXT_PUBLIC_BASE_RPC_URL',
  baseSepoliaRpcUrl: 'NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL',
  walletConnectProjectId: 'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
} as const satisfies Record<keyof RetryWeb3EnvInput, string>

/**
 * Reads the four RETRY variables from a plain record using a prefix, e.g.
 * `import.meta.env` with `VITE_` in the playground. Do not use this with
 * `process.env` in Next.js client code (see {@link RetryWeb3EnvInput}).
 */
export function readRetryWeb3EnvFromRecord(
  record: Readonly<Record<string, unknown>>,
  prefix = 'NEXT_PUBLIC_',
): RetryWeb3EnvInput {
  const read = (name: string): string | undefined => {
    const value = record[`${prefix}${name}`]
    return typeof value === 'string' ? value : undefined
  }
  return {
    defaultChain: read('DEFAULT_NETWORK'),
    baseMainnetRpcUrl: read('BASE_RPC_URL'),
    baseSepoliaRpcUrl: read('BASE_SEPOLIA_RPC_URL'),
    walletConnectProjectId: read('WALLETCONNECT_PROJECT_ID'),
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Accepts https URLs, plus plain http for a local node (anvil/hardhat fork). */
export function isValidRpcUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.username || url.password) return false
  if (url.protocol === 'https:') return true
  return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)
}

/** WalletConnect / Reown Cloud project IDs are 32 hexadecimal characters. */
export function isValidWalletConnectProjectId(value: string): boolean {
  return /^[0-9a-f]{32}$/i.test(value)
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function parseRetryWeb3Env(input: RetryWeb3EnvInput = {}): RetryWeb3Env {
  const warnings: string[] = []

  const rawChain = clean(input.defaultChain)
  const chainKey = parseChainKey(rawChain)
  if (rawChain && !chainKey) {
    warnings.push(
      `${RETRY_WEB3_ENV_VARS.defaultChain} must be "base-sepolia" or "base". Falling back to Base Sepolia.`,
    )
  }
  const defaultChainId = chainKey ? getRetryNetworkByKey(chainKey).id : DEFAULT_RETRY_CHAIN_ID

  const rpcUrls: Partial<Record<RetrySupportedChainId, string>> = {}
  const rpcInputs = [
    [BASE_MAINNET_CHAIN_ID, clean(input.baseMainnetRpcUrl), RETRY_WEB3_ENV_VARS.baseMainnetRpcUrl],
    [BASE_SEPOLIA_CHAIN_ID, clean(input.baseSepoliaRpcUrl), RETRY_WEB3_ENV_VARS.baseSepoliaRpcUrl],
  ] as const
  for (const [chainId, url, variable] of rpcInputs) {
    if (!url) continue
    if (isValidRpcUrl(url)) rpcUrls[chainId] = url
    // The value itself is never echoed: RPC URLs frequently embed API keys.
    else warnings.push(`${variable} is not a valid https URL and was ignored.`)
  }

  let walletConnectProjectId = clean(input.walletConnectProjectId)
  if (walletConnectProjectId && !isValidWalletConnectProjectId(walletConnectProjectId)) {
    warnings.push(
      `${RETRY_WEB3_ENV_VARS.walletConnectProjectId} does not look like a WalletConnect project ID. WalletConnect is disabled.`,
    )
    walletConnectProjectId = undefined
  }

  return { defaultChainId, rpcUrls, walletConnectProjectId, warnings }
}
