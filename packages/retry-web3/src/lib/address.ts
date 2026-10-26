import { type Address, getAddress, isAddress } from 'viem'

export type { Address }

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const satisfies Address

/**
 * True for a 20-byte hex address. Mixed-case input must carry a valid
 * EIP-55 checksum, which catches most typos in copied addresses.
 */
export function isEvmAddress(value: unknown): value is Address {
  return typeof value === 'string' && isAddress(value, { strict: true })
}

/** Returns the EIP-55 checksummed address, or `undefined` when invalid. */
export function parseEvmAddress(value: unknown): Address | undefined {
  return isEvmAddress(value) ? getAddress(value) : undefined
}

export function isSameAddress(a: unknown, b: unknown): boolean {
  const left = parseEvmAddress(a)
  const right = parseEvmAddress(b)
  return left !== undefined && left === right
}

export interface ShortenAddressOptions {
  /** Characters kept at the start, including `0x`. Default 6. */
  head?: number
  /** Characters kept at the end. Default 4. */
  tail?: number
}

/**
 * `0x84A2...3F91` style abbreviation of a checksummed address.
 * Returns an empty string for invalid input so callers never render garbage.
 */
export function shortenAddress(address: unknown, options: ShortenAddressOptions = {}): string {
  const checksummed = parseEvmAddress(address)
  if (!checksummed) return ''
  const head = Math.max(options.head ?? 6, 3)
  const tail = Math.max(options.tail ?? 4, 1)
  if (head + tail >= checksummed.length) return checksummed
  return `${checksummed.slice(0, head)}...${checksummed.slice(-tail)}`
}
