import { base, baseSepolia } from 'viem/chains'

/**
 * RETRY runs exclusively on Base. The chain objects come straight from viem
 * (`viem/chains`) so that IDs, native currency, public RPC and explorer data
 * stay in sync with the upstream, audited definitions.
 */
export { base, baseSepolia }

export const BASE_MAINNET_CHAIN_ID = 8453 as const
export const BASE_SEPOLIA_CHAIN_ID = 84532 as const

export const SUPPORTED_CHAIN_IDS = [BASE_MAINNET_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID] as const
export type RetrySupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number]

export type RetryChain = typeof base | typeof baseSepolia
export type RetryChainKey = 'base' | 'base-sepolia'
export type RetryNetworkEnvironment = 'production' | 'development'

export interface RetryNetworkInfo {
  key: RetryChainKey
  id: RetrySupportedChainId
  chain: RetryChain
  /** Display name, e.g. "Base Sepolia". */
  name: string
  environment: RetryNetworkEnvironment
  isTestnet: boolean
  nativeSymbol: string
  nativeDecimals: number
  explorerName: string
  explorerUrl: string
  /** Rate-limited public endpoint published by Base. Not meant for production traffic. */
  publicRpcUrl: string
}

function describe(
  key: RetryChainKey,
  chain: RetryChain,
  environment: RetryNetworkEnvironment,
): RetryNetworkInfo {
  const publicRpcUrl = chain.rpcUrls.default.http[0]
  if (!publicRpcUrl) throw new Error(`Missing public RPC URL for chain ${chain.id}`)
  return {
    key,
    id: chain.id,
    chain,
    name: chain.name,
    environment,
    isTestnet: Boolean(chain.testnet),
    nativeSymbol: chain.nativeCurrency.symbol,
    nativeDecimals: chain.nativeCurrency.decimals,
    explorerName: chain.blockExplorers.default.name,
    explorerUrl: chain.blockExplorers.default.url,
    publicRpcUrl,
  }
}

export const RETRY_NETWORKS: Readonly<Record<RetrySupportedChainId, RetryNetworkInfo>> = {
  [BASE_MAINNET_CHAIN_ID]: describe('base', base, 'production'),
  [BASE_SEPOLIA_CHAIN_ID]: describe('base-sepolia', baseSepolia, 'development'),
}

/** Recommended network for local development and QA. */
export const DEFAULT_RETRY_CHAIN_ID: RetrySupportedChainId = BASE_SEPOLIA_CHAIN_ID

export function isSupportedChainId(chainId: unknown): chainId is RetrySupportedChainId {
  return chainId === BASE_MAINNET_CHAIN_ID || chainId === BASE_SEPOLIA_CHAIN_ID
}

export function getRetryNetwork(chainId: number | undefined): RetryNetworkInfo | undefined {
  return isSupportedChainId(chainId) ? RETRY_NETWORKS[chainId] : undefined
}

export function getRetryNetworkByKey(key: RetryChainKey): RetryNetworkInfo {
  return key === 'base' ? RETRY_NETWORKS[BASE_MAINNET_CHAIN_ID] : RETRY_NETWORKS[BASE_SEPOLIA_CHAIN_ID]
}

const CHAIN_KEY_ALIASES: Readonly<Record<string, RetryChainKey>> = {
  base: 'base',
  'base-mainnet': 'base',
  base_mainnet: 'base',
  basemainnet: 'base',
  mainnet: 'base',
  '8453': 'base',
  'base-sepolia': 'base-sepolia',
  base_sepolia: 'base-sepolia',
  basesepolia: 'base-sepolia',
  sepolia: 'base-sepolia',
  '84532': 'base-sepolia',
}

/**
 * Parses values such as `base-sepolia`, `baseSepolia`, `84532`, `base` or `8453`.
 * Returns `undefined` for anything else so callers can decide how to fall back.
 */
export function parseChainKey(value: string | undefined | null): RetryChainKey | undefined {
  if (!value) return undefined
  return CHAIN_KEY_ALIASES[value.trim().toLowerCase()]
}

/**
 * Friendly names for networks a wallet is commonly connected to. Only used to
 * explain a "Wrong Network" state; none of these chains are supported.
 */
const KNOWN_CHAIN_NAMES: Readonly<Record<number, string>> = {
  1: 'Ethereum',
  10: 'OP Mainnet',
  56: 'BNB Smart Chain',
  100: 'Gnosis',
  137: 'Polygon',
  324: 'zkSync Era',
  42161: 'Arbitrum One',
  42220: 'Celo',
  43114: 'Avalanche',
  59144: 'Linea',
  81457: 'Blast',
  534352: 'Scroll',
  7777777: 'Zora',
  17000: 'Holesky',
  11155111: 'Sepolia',
  11155420: 'OP Sepolia',
  421614: 'Arbitrum Sepolia',
}

export function getChainDisplayName(chainId: number | undefined): string {
  if (chainId === undefined) return 'Unknown network'
  const supported = getRetryNetwork(chainId)
  if (supported) return supported.name
  return KNOWN_CHAIN_NAMES[chainId] ?? `Chain ${chainId}`
}
