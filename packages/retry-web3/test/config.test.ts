import { describe, expect, it, vi } from 'vitest'
import { createRetryConnectors } from '../src/config/connectors.js'
import { planRpcEndpoints } from '../src/config/transports.js'
import {
  createRetryWeb3Config,
  getRetryInitialState,
  RETRY_FINANCIAL_OPERATIONS_ENABLED,
} from '../src/config/wagmi.js'

// The WalletConnect connector initialises its SDK on setup; keep tests offline.
vi.mock('@walletconnect/ethereum-provider', () => ({
  EthereumProvider: { init: () => new Promise(() => {}) },
  default: { init: () => new Promise(() => {}) },
}))

const PROJECT_ID = '0123456789abcdef0123456789abcdef'

describe('createRetryWeb3Config', () => {
  it('targets Base Sepolia by default and keeps it first in the chain list', () => {
    const { wagmiConfig, settings } = createRetryWeb3Config({ storage: 'none' })
    expect(settings.targetChainId).toBe(84532)
    expect(settings.environment).toBe('development')
    expect(wagmiConfig.chains.map((chain) => chain.id)).toEqual([84532, 8453])
  })

  it('targets Base Mainnet in production', () => {
    const { wagmiConfig, settings } = createRetryWeb3Config({
      env: { defaultChain: 'base' },
      storage: 'none',
    })
    expect(settings.targetChainId).toBe(8453)
    expect(settings.environment).toBe('production')
    expect(wagmiConfig.chains.map((chain) => chain.id)).toEqual([8453, 84532])
  })

  it('registers MetaMask, Coinbase Wallet and an injected fallback, without WalletConnect by default', () => {
    const { wagmiConfig, settings } = createRetryWeb3Config({ storage: 'none' })
    expect(wagmiConfig.connectors.map((connector) => connector.id)).toEqual([
      'injected',
      'metaMaskSDK',
      'coinbaseWalletSDK',
    ])
    expect(settings.walletConnectEnabled).toBe(false)
  })

  it('adds WalletConnect only with a valid project ID', () => {
    expect(
      createRetryConnectors({ app: { name: 'RETRY' }, walletConnectProjectId: PROJECT_ID }),
    ).toHaveLength(4)
    const { wagmiConfig, settings } = createRetryWeb3Config({
      env: { walletConnectProjectId: PROJECT_ID },
      storage: 'none',
    })
    expect(wagmiConfig.connectors.map((connector) => connector.id)).toContain('walletConnect')
    expect(settings.walletConnectEnabled).toBe(true)

    const invalid = createRetryWeb3Config({ env: { walletConnectProjectId: 'placeholder' }, storage: 'none' })
    expect(invalid.settings.walletConnectEnabled).toBe(false)
    expect(invalid.settings.warnings).toHaveLength(1)
  })

  it('plans custom RPC first, then the public Base endpoint', () => {
    const plan = planRpcEndpoints({ 84532: 'https://sepolia.example.com/key' })
    expect(plan[84532].endpoints).toEqual([
      { kind: 'custom', url: 'https://sepolia.example.com/key' },
      { kind: 'public', url: 'https://sepolia.base.org' },
    ])
    expect(plan[8453].endpoints).toEqual([{ kind: 'public', url: 'https://mainnet.base.org' }])
    expect(
      planRpcEndpoints({ 84532: 'https://x.example.com' }, { publicFallback: false })[84532].endpoints,
    ).toHaveLength(1)
  })

  it('exposes RPC origins only, never paths or keys', () => {
    const { settings } = createRetryWeb3Config({
      env: { baseSepoliaRpcUrl: 'https://base-sepolia.g.alchemy.com/v2/secret-key' },
      storage: 'none',
    })
    expect(settings.rpc[84532]).toEqual([
      { kind: 'custom', origin: 'https://base-sepolia.g.alchemy.com' },
      { kind: 'public', origin: 'https://sepolia.base.org' },
    ])
    expect(JSON.stringify(settings)).not.toContain('secret-key')
  })

  it('keeps financial operations disabled', () => {
    expect(RETRY_FINANCIAL_OPERATIONS_ENABLED).toBe(false)
    expect(createRetryWeb3Config({ storage: 'none' }).settings.financialOperationsEnabled).toBe(false)
  })

  it('restores SSR state from the request cookie', () => {
    const config = createRetryWeb3Config({ ssr: true })
    expect(config.wagmiConfig.storage?.key).toBe('retry.wagmi')
    expect(getRetryInitialState(config, undefined)).toBeUndefined()
    // wagmi writes the serialized store into the cookie as-is (not URI encoded).
    const cookie = `other=1; retry.wagmi.store=${JSON.stringify({
      state: { chainId: 84532, connections: { __type: 'Map', value: [] }, current: null },
      version: 2,
    })}`
    expect(getRetryInitialState(config, cookie)?.chainId).toBe(84532)
  })
})
