import { describe, expect, it } from 'vitest'
import {
  isValidRpcUrl,
  isValidWalletConnectProjectId,
  parseRetryWeb3Env,
  readRetryWeb3EnvFromRecord,
} from '../src/config/env.js'

const PROJECT_ID = '0123456789abcdef0123456789abcdef'

describe('environment parsing', () => {
  it('defaults to Base Sepolia with no configuration', () => {
    const env = parseRetryWeb3Env({})
    expect(env.defaultChainId).toBe(84532)
    expect(env.rpcUrls).toEqual({})
    expect(env.walletConnectProjectId).toBeUndefined()
    expect(env.warnings).toEqual([])
  })

  it('selects Base Mainnet when NEXT_PUBLIC_DEFAULT_NETWORK=base', () => {
    expect(parseRetryWeb3Env({ defaultChain: 'base' }).defaultChainId).toBe(8453)
  })

  it('falls back to Base Sepolia and warns on an unknown chain', () => {
    const env = parseRetryWeb3Env({ defaultChain: 'arbitrum' })
    expect(env.defaultChainId).toBe(84532)
    expect(env.warnings[0]).toMatch(/NEXT_PUBLIC_DEFAULT_NETWORK/)
  })

  it('accepts https RPC URLs and local http nodes', () => {
    expect(isValidRpcUrl('https://base-sepolia.g.alchemy.com/v2/key')).toBe(true)
    expect(isValidRpcUrl('http://localhost:8545')).toBe(true)
    expect(isValidRpcUrl('http://127.0.0.1:8545')).toBe(true)
  })

  it('rejects insecure, malformed or credential-bearing RPC URLs', () => {
    expect(isValidRpcUrl('http://rpc.example.com')).toBe(false)
    expect(isValidRpcUrl('ftp://rpc.example.com')).toBe(false)
    expect(isValidRpcUrl('not a url')).toBe(false)
    expect(isValidRpcUrl('https://user:pass@rpc.example.com')).toBe(false)
  })

  it('keeps valid RPC URLs and never echoes rejected values in warnings', () => {
    const secret = 'http://rpc.example.com/super-secret-key'
    const env = parseRetryWeb3Env({
      baseSepoliaRpcUrl: 'https://sepolia.example.com/key',
      baseMainnetRpcUrl: secret,
    })
    expect(env.rpcUrls[84532]).toBe('https://sepolia.example.com/key')
    expect(env.rpcUrls[8453]).toBeUndefined()
    expect(env.warnings).toHaveLength(1)
    expect(env.warnings.join(' ')).not.toContain('super-secret-key')
  })

  it('validates WalletConnect project IDs', () => {
    expect(isValidWalletConnectProjectId(PROJECT_ID)).toBe(true)
    expect(isValidWalletConnectProjectId('your_project_id')).toBe(false)
    expect(parseRetryWeb3Env({ walletConnectProjectId: PROJECT_ID }).walletConnectProjectId).toBe(PROJECT_ID)
    const invalid = parseRetryWeb3Env({ walletConnectProjectId: 'changeme' })
    expect(invalid.walletConnectProjectId).toBeUndefined()
    expect(invalid.warnings[0]).toMatch(/WalletConnect is disabled/)
  })

  it('treats blank values as missing', () => {
    const env = parseRetryWeb3Env({ walletConnectProjectId: '  ', baseSepoliaRpcUrl: '', defaultChain: ' ' })
    expect(env).toEqual({
      defaultChainId: 84532,
      rpcUrls: {},
      walletConnectProjectId: undefined,
      warnings: [],
    })
  })

  it('reads prefixed variables from a record (Vite playground)', () => {
    const input = readRetryWeb3EnvFromRecord(
      {
        VITE_DEFAULT_NETWORK: 'base',
        VITE_BASE_SEPOLIA_RPC_URL: 'https://sepolia.example.com',
        VITE_WALLETCONNECT_PROJECT_ID: PROJECT_ID,
        VITE_BASE_RPC_URL: 42,
      },
      'VITE_',
    )
    expect(input).toEqual({
      defaultChain: 'base',
      baseMainnetRpcUrl: undefined,
      baseSepoliaRpcUrl: 'https://sepolia.example.com',
      walletConnectProjectId: PROJECT_ID,
    })
  })
})
