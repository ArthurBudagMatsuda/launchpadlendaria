import { describe, expect, it } from 'vitest'
import {
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  getChainDisplayName,
  getRetryNetwork,
  isSupportedChainId,
  parseChainKey,
  RETRY_NETWORKS,
  SUPPORTED_CHAIN_IDS,
} from '../src/config/chains.js'

describe('Base networks', () => {
  it('configures Base Mainnet as production with chain ID 8453 and ETH', () => {
    const network = RETRY_NETWORKS[BASE_MAINNET_CHAIN_ID]
    expect(network.id).toBe(8453)
    expect(network.name).toBe('Base')
    expect(network.nativeSymbol).toBe('ETH')
    expect(network.nativeDecimals).toBe(18)
    expect(network.environment).toBe('production')
    expect(network.isTestnet).toBe(false)
    expect(network.explorerUrl).toBe('https://basescan.org')
    expect(network.publicRpcUrl).toBe('https://mainnet.base.org')
  })

  it('configures Base Sepolia as development with chain ID 84532 and ETH', () => {
    const network = RETRY_NETWORKS[BASE_SEPOLIA_CHAIN_ID]
    expect(network.id).toBe(84532)
    expect(network.name).toBe('Base Sepolia')
    expect(network.nativeSymbol).toBe('ETH')
    expect(network.environment).toBe('development')
    expect(network.isTestnet).toBe(true)
    expect(network.explorerUrl).toBe('https://sepolia.basescan.org')
    expect(network.publicRpcUrl).toBe('https://sepolia.base.org')
  })

  it('supports exactly the two Base networks', () => {
    expect([...SUPPORTED_CHAIN_IDS].sort()).toEqual([8453, 84532])
  })

  it.each([
    [8453, true],
    [84532, true],
    [1, false],
    [42161, false],
    [11155111, false],
    ['8453', false],
    [undefined, false],
    [Number.NaN, false],
  ])('isSupportedChainId(%s) is %s', (input, expected) => {
    expect(isSupportedChainId(input)).toBe(expected)
  })

  it('returns no network info for unsupported chains', () => {
    expect(getRetryNetwork(1)).toBeUndefined()
    expect(getRetryNetwork(undefined)).toBeUndefined()
    expect(getRetryNetwork(84532)?.name).toBe('Base Sepolia')
  })

  it.each([
    ['base-sepolia', 'base-sepolia'],
    ['baseSepolia', 'base-sepolia'],
    [' 84532 ', 'base-sepolia'],
    ['BASE', 'base'],
    ['8453', 'base'],
    ['mainnet', 'base'],
    ['arbitrum', undefined],
    ['', undefined],
    [undefined, undefined],
  ])('parseChainKey(%s) → %s', (input, expected) => {
    expect(parseChainKey(input)).toBe(expected)
  })

  it('names unsupported chains for Wrong Network messages', () => {
    expect(getChainDisplayName(1)).toBe('Ethereum')
    expect(getChainDisplayName(42161)).toBe('Arbitrum One')
    expect(getChainDisplayName(999999)).toBe('Chain 999999')
    expect(getChainDisplayName(84532)).toBe('Base Sepolia')
  })
})
