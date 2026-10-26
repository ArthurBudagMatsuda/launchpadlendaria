import { getRetryNetwork } from '../config/chains.js'
import { parseEvmAddress } from './address.js'

const TX_HASH = /^0x[0-9a-fA-F]{64}$/

/**
 * Explorer link builders. They only produce links for Base / Base Sepolia and
 * for inputs that pass validation; anything else returns `undefined`, so the
 * UI never links to an unvalidated target.
 */
export function getExplorerUrl(chainId: number | undefined): string | undefined {
  return getRetryNetwork(chainId)?.explorerUrl
}

export function getExplorerAddressUrl(chainId: number | undefined, address: unknown): string | undefined {
  const root = getExplorerUrl(chainId)
  const checksummed = parseEvmAddress(address)
  return root && checksummed ? `${root}/address/${checksummed}` : undefined
}

export function getExplorerContractUrl(chainId: number | undefined, address: unknown): string | undefined {
  const url = getExplorerAddressUrl(chainId, address)
  return url ? `${url}#code` : undefined
}

export function getExplorerTokenUrl(chainId: number | undefined, address: unknown): string | undefined {
  const root = getExplorerUrl(chainId)
  const checksummed = parseEvmAddress(address)
  return root && checksummed ? `${root}/token/${checksummed}` : undefined
}

export function getExplorerTxUrl(chainId: number | undefined, hash: unknown): string | undefined {
  const root = getExplorerUrl(chainId)
  return root && typeof hash === 'string' && TX_HASH.test(hash) ? `${root}/tx/${hash}` : undefined
}

export function getExplorerBlockUrl(
  chainId: number | undefined,
  block: bigint | number | undefined,
): string | undefined {
  const root = getExplorerUrl(chainId)
  if (!root || block === undefined) return undefined
  const value = typeof block === 'bigint' ? block : Number.isSafeInteger(block) ? BigInt(block) : -1n
  return value >= 0n ? `${root}/block/${value}` : undefined
}
