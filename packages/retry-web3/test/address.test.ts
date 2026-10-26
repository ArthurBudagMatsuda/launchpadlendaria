import { describe, expect, it } from 'vitest'
import { isEvmAddress, isSameAddress, parseEvmAddress, shortenAddress } from '../src/lib/address.js'
import {
  getExplorerAddressUrl,
  getExplorerBlockUrl,
  getExplorerContractUrl,
  getExplorerTokenUrl,
  getExplorerTxUrl,
} from '../src/lib/explorer.js'

const LOWER = '0x84a2c0b2e6dc6e1f2c3a4b5d6e7f8091a2b33f91'
const CHECKSUM = '0x84a2C0B2e6dc6e1F2C3A4B5D6e7f8091A2B33F91'
const BAD_CHECKSUM = '0x84A2c0b2E6dC6e1f2C3a4B5D6e7F8091a2B33F91'
const TX = `0x${'ab'.repeat(32)}`

describe('EVM address validation', () => {
  it('accepts lowercase and correctly checksummed addresses', () => {
    expect(isEvmAddress(LOWER)).toBe(true)
    expect(isEvmAddress(CHECKSUM)).toBe(true)
  })

  it('rejects wrong checksums, wrong length and non-hex input', () => {
    expect(isEvmAddress(BAD_CHECKSUM)).toBe(false)
    expect(isEvmAddress('0x1234')).toBe(false)
    expect(isEvmAddress(`0x${'g'.repeat(40)}`)).toBe(false)
    expect(isEvmAddress(LOWER.slice(2))).toBe(false)
    expect(isEvmAddress(undefined)).toBe(false)
    expect(isEvmAddress(42)).toBe(false)
  })

  it('normalises to EIP-55 checksum', () => {
    expect(parseEvmAddress(LOWER)).toBe(CHECKSUM)
    expect(parseEvmAddress(BAD_CHECKSUM)).toBeUndefined()
    expect(isSameAddress(LOWER, CHECKSUM)).toBe(true)
    expect(isSameAddress(LOWER, '0x1111111111111111111111111111111111111111')).toBe(false)
    expect(isSameAddress(undefined, undefined)).toBe(false)
  })

  it('shortens as 0x84A2...3F91 style', () => {
    expect(shortenAddress(LOWER)).toBe('0x84a2...3F91')
    expect(shortenAddress(LOWER)).toMatch(/^0x[0-9a-fA-F]{4}\.\.\.[0-9a-fA-F]{4}$/)
    expect(shortenAddress(LOWER, { head: 4, tail: 6 })).toBe('0x84...B33F91')
    expect(shortenAddress('nope')).toBe('')
  })
})

describe('explorer links', () => {
  it('builds Basescan links for the correct network', () => {
    expect(getExplorerAddressUrl(84532, LOWER)).toBe(`https://sepolia.basescan.org/address/${CHECKSUM}`)
    expect(getExplorerAddressUrl(8453, LOWER)).toBe(`https://basescan.org/address/${CHECKSUM}`)
    expect(getExplorerContractUrl(8453, LOWER)).toBe(`https://basescan.org/address/${CHECKSUM}#code`)
    expect(getExplorerTokenUrl(84532, LOWER)).toBe(`https://sepolia.basescan.org/token/${CHECKSUM}`)
    expect(getExplorerTxUrl(8453, TX)).toBe(`https://basescan.org/tx/${TX}`)
    expect(getExplorerBlockUrl(84532, 123n)).toBe('https://sepolia.basescan.org/block/123')
  })

  it('refuses unsupported chains and invalid targets', () => {
    expect(getExplorerAddressUrl(1, LOWER)).toBeUndefined()
    expect(getExplorerAddressUrl(8453, BAD_CHECKSUM)).toBeUndefined()
    expect(getExplorerTxUrl(8453, '0x1234')).toBeUndefined()
    expect(getExplorerTxUrl(8453, `${TX}"><script>`)).toBeUndefined()
    expect(getExplorerBlockUrl(8453, -1)).toBeUndefined()
  })
})
