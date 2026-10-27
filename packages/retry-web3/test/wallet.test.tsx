import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpRequestError } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { useRetryWallet } from '../src/react/hooks/useRetryWallet.js'
import {
  RETRY_WALLET_CLOSED_GRACE_MS,
  useRetryWalletActions,
} from '../src/react/hooks/useRetryWalletActions.js'
import { type RetryWalletEvent, useRetryWalletEvents } from '../src/react/hooks/useRetryWalletEvents.js'
import { MOCK_WALLET_ACCOUNTS } from '../src/testing/index.js'
import { createTestSetup, ETH } from './utils.js'

const [ALICE, BOB] = MOCK_WALLET_ACCOUNTS
const ALICE_SEPOLIA = 23_400_000_000_000_000n // 0.0234 ETH

type RpcCall = { chainId: number; method: string; params: unknown }
const isBalanceRead = (call: RpcCall) => call.method === 'eth_getBalance' || call.method === 'eth_call'
const readsFor = (calls: RpcCall[], chainId: number, address: string) =>
  calls.filter(
    (call) =>
      call.chainId === chainId &&
      isBalanceRead(call) &&
      JSON.stringify(call.params).toLowerCase().includes(address.slice(2).toLowerCase()),
  )

function useWalletUnderTest(onEvent?: (event: RetryWalletEvent) => void) {
  useRetryWalletEvents(onEvent ?? (() => {}))
  return { wallet: useRetryWallet(), actions: useRetryWalletActions() }
}

function setup(
  options: Parameters<typeof createTestSetup>[0] = {},
  onEvent?: (event: RetryWalletEvent) => void,
) {
  const env = createTestSetup({
    balances: {
      84532: { [ALICE.toLowerCase()]: ALICE_SEPOLIA, [BOB.toLowerCase()]: 2n * ETH },
      8453: { [ALICE.toLowerCase()]: 5n * ETH },
    },
    ...options,
  })
  const hook = renderHook(() => useWalletUnderTest(onEvent), { wrapper: env.Wrapper })
  const connect = async () => {
    const connector = env.config.wagmiConfig.connectors[0]
    if (!connector) throw new Error('missing mock connector')
    act(() => hook.result.current.actions.connect(connector))
    await waitFor(() => expect(hook.result.current.wallet.status).not.toBe('connecting'))
  }
  return { ...env, hook, connect }
}

describe('wallet state', () => {
  it('starts disconnected with no address, network or balance', () => {
    const { hook, rpcCalls } = setup()
    const { wallet } = hook.result.current
    expect(wallet.status).toBe('disconnected')
    expect(wallet.address).toBeUndefined()
    expect(wallet.chainId).toBeUndefined()
    expect(wallet.network.scenario).toBe('disconnected')
    expect(wallet.balance.status).toBe('disconnected')
    expect(wallet.balance.value).toBeUndefined()
    expect(rpcCalls).toHaveLength(0)
  })

  it('connects through the wallet provider and reads the real balance from the chain RPC', async () => {
    const events: RetryWalletEvent[] = []
    const { hook, connect, provider, rpcCalls } = setup({}, (event) => events.push(event))
    await connect()

    const { wallet } = hook.result.current
    expect(wallet.status).toBe('connected')
    expect(wallet.address).toBe(ALICE)
    expect(wallet.shortAddress).toBe(`${ALICE.slice(0, 6)}...${ALICE.slice(-4)}`)
    expect(wallet.connector?.name).toBe('Mock Wallet')
    expect(wallet.chainId).toBe(84532)
    expect(wallet.networkName).toBe('Base Sepolia')
    expect(wallet.network.scenario).toBe('target')
    expect(wallet.explorerAddressUrl).toBe(`https://sepolia.basescan.org/address/${ALICE}`)
    expect(provider.calls.map((call) => call.method)).toContain('wallet_requestPermissions')

    await waitFor(() => expect(hook.result.current.wallet.balance.status).toBe('success'))
    const { balance } = hook.result.current.wallet
    expect(balance.value).toBe(ALICE_SEPOLIA)
    expect(balance.formatted).toBe('0.0234')
    expect(balance.display).toBe('0.0234 ETH')
    expect(balance.chainId).toBe(84532)
    expect(readsFor(rpcCalls, 84532, ALICE).length).toBeGreaterThan(0)
    // Balance reads never go through the wallet and never ask for a signature.
    expect(provider.calls.map((call) => call.method)).not.toContain('eth_getBalance')
    expect(events.map((event) => event.type)).toEqual(['connected'])
  })

  it('surfaces a rejected connection and stays disconnected', async () => {
    const { hook, connect } = setup({ wallet: { rejectConnect: true } })
    await connect()
    await waitFor(() => expect(hook.result.current.actions.connectStatus).toBe('error'))
    expect(hook.result.current.wallet.status).toBe('disconnected')
    expect(hook.result.current.actions.connectError?.code).toBe('CONNECTION_REJECTED')
    expect(hook.result.current.actions.connectError?.message).toBe('Connection rejected. Please try again.')
  })

  it('stops waiting when the wallet window closes without answering', async () => {
    const { hook, config } = setup({ wallet: { ignoreConnect: true } })
    const connector = config.wagmiConfig.connectors[0]
    if (!connector) throw new Error('missing mock connector')
    act(() => hook.result.current.actions.connect(connector))
    await waitFor(() => expect(hook.result.current.actions.pendingConnectorUid).toBe(connector.uid))
    expect(hook.result.current.wallet.status).toBe('connecting')

    // The extension opens its own window (the page loses focus), then the user closes it.
    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(hook.result.current.actions.connectError?.code).toBe('WALLET_NO_RESPONSE'), {
      timeout: RETRY_WALLET_CLOSED_GRACE_MS + 1_000,
    })
    const { actions, wallet } = hook.result.current
    expect(actions.connectStatus).toBe('error')
    expect(actions.pendingConnectorUid).toBeUndefined()
    expect(actions.connectError?.message).toBe(
      "Your wallet didn't confirm the connection. Make sure it is unlocked with an Ethereum (EVM) account selected, then try again.",
    )
    expect(wallet.status).toBe('disconnected')
  })

  it('keeps waiting while the page never lost focus', async () => {
    const { hook, config } = setup({ wallet: { ignoreConnect: true } })
    const connector = config.wagmiConfig.connectors[0]
    if (!connector) throw new Error('missing mock connector')
    act(() => hook.result.current.actions.connect(connector))
    await waitFor(() => expect(hook.result.current.actions.pendingConnectorUid).toBe(connector.uid))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await act(() => new Promise((resolve) => setTimeout(resolve, RETRY_WALLET_CLOSED_GRACE_MS + 200)))
    expect(hook.result.current.actions.pendingConnectorUid).toBe(connector.uid)
    expect(hook.result.current.actions.connectError).toBeUndefined()
  })

  it('cancels a pending connection, and a late approval in the wallet still connects', async () => {
    const { hook, config, provider } = setup({ wallet: { ignoreConnect: true } })
    const connector = config.wagmiConfig.connectors[0]
    if (!connector) throw new Error('missing mock connector')
    act(() => hook.result.current.actions.connect(connector))
    await waitFor(() => expect(hook.result.current.actions.pendingConnectorUid).toBe(connector.uid))

    act(() => hook.result.current.actions.cancelConnect())
    expect(hook.result.current.actions.pendingConnectorUid).toBeUndefined()
    expect(hook.result.current.actions.connectStatus).toBe('idle')
    expect(hook.result.current.actions.connectError).toBeUndefined()
    expect(hook.result.current.wallet.status).toBe('disconnected')

    act(() => provider.approvePendingConnect())
    await waitFor(() => expect(hook.result.current.wallet.status).toBe('connected'))
    expect(hook.result.current.wallet.address).toBe(ALICE)
  })

  it('reports WalletConnect as not configured instead of failing silently', () => {
    const { hook } = setup()
    act(() => hook.result.current.actions.connect('walletConnect'))
    expect(hook.result.current.actions.connectError?.code).toBe('WALLETCONNECT_NOT_CONFIGURED')
    expect(hook.result.current.actions.connectError?.message).toBe('WalletConnect is not configured yet.')
  })
})

describe('network handling', () => {
  it('detects an unsupported chain (Ethereum) as Wrong Network and does not read the balance', async () => {
    const { hook, connect, rpcCalls } = setup({ wallet: { chainId: 1 } })
    await connect()
    const { wallet } = hook.result.current
    expect(wallet.chainId).toBe(1)
    expect(wallet.networkName).toBe('Ethereum')
    expect(wallet.network.scenario).toBe('wrong-network')
    expect(wallet.network.isWrongNetwork).toBe(true)
    expect(wallet.network.notice?.title).toBe('Wrong Network')
    expect(wallet.network.switchLabel).toBe('Switch to Base Sepolia')
    expect(wallet.balance.status).toBe('wrong-network')
    expect(wallet.balance.error?.message).toBe('Please switch to Base Sepolia.')
    expect(rpcCalls.filter(isBalanceRead)).toHaveLength(0)
  })

  it('never switches network without an explicit action', async () => {
    const { connect, provider } = setup({ wallet: { chainId: 42161 } })
    await connect()
    expect(provider.calls.map((call) => call.method)).not.toContain('wallet_switchEthereumChain')
  })

  it('switches to Base Sepolia on request', async () => {
    const { hook, connect, provider } = setup({ wallet: { chainId: 1 } })
    await connect()
    act(() => hook.result.current.wallet.network.switchToTarget())
    await waitFor(() => expect(hook.result.current.wallet.network.scenario).toBe('target'))
    expect(provider.calls).toContainEqual({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x14a34' }],
    })
    await waitFor(() => expect(hook.result.current.wallet.balance.formatted).toBe('0.0234'))
    // The switch only counts once the wallet stays on Base Sepolia.
    await waitFor(() => expect(hook.result.current.wallet.network.isSwitching).toBe(false), {
      timeout: 3_000,
    })
    expect(hook.result.current.wallet.network.switchError).toBeUndefined()
    expect(hook.result.current.wallet.network.scenario).toBe('target')
  })

  it('reports a switch the wallet confirms and then undoes (Phantom)', async () => {
    const { hook, connect, provider } = setup({ wallet: { chainId: 1, revertSwitch: true } })
    await connect()
    act(() => hook.result.current.wallet.network.switchToTarget())
    await waitFor(() =>
      expect(hook.result.current.wallet.network.switchError?.code).toBe('SWITCH_NOT_APPLIED'),
    )
    const { network } = hook.result.current.wallet
    expect(network.switchError?.message).toBe(
      'Mock Wallet switched back to Ethereum. Open Mock Wallet, choose Base Sepolia there, and try again.',
    )
    expect(network.scenario).toBe('wrong-network')
    expect(network.switchStatus).toBe('error')
    expect(network.isSwitching).toBe(false)
    // One request from the click; the app never retries or switches on its own.
    expect(provider.calls.filter((call) => call.method === 'wallet_switchEthereumChain')).toHaveLength(1)

    // Choosing Base Sepolia in the wallet clears the message.
    act(() => provider.changeChain(84532))
    await waitFor(() => expect(hook.result.current.wallet.network.scenario).toBe('target'))
    expect(hook.result.current.wallet.network.switchError).toBeUndefined()
  })

  it('adds Base Sepolia to the wallet when it is unknown (4902)', async () => {
    const { hook, connect, provider } = setup({ wallet: { chainId: 1, knownChainIds: [1] } })
    await connect()
    act(() => hook.result.current.wallet.network.switchToTarget())
    await waitFor(() => expect(hook.result.current.wallet.network.scenario).toBe('target'))
    expect(provider.calls.map((call) => call.method)).toContain('wallet_addEthereumChain')
  })

  it('reports a rejected network switch', async () => {
    const { hook, connect } = setup({ wallet: { chainId: 1, rejectSwitch: true } })
    await connect()
    act(() => hook.result.current.wallet.network.switchToTarget())
    await waitFor(() => expect(hook.result.current.wallet.network.switchStatus).toBe('error'))
    expect(hook.result.current.wallet.network.switchError?.code).toBe('SWITCH_REJECTED')
    expect(hook.result.current.wallet.network.switchError?.message).toBe(
      'Network switch rejected. Please switch to Base Sepolia.',
    )
    expect(hook.result.current.wallet.network.scenario).toBe('wrong-network')
  })

  it('treats Base Mainnet as valid but read-only during development', async () => {
    const { hook, connect } = setup({ wallet: { chainId: 8453 } })
    await connect()
    const { network } = hook.result.current.wallet
    expect(network.scenario).toBe('supported')
    expect(network.isSupported).toBe(true)
    expect(network.financialOperationsEnabled).toBe(false)
    expect(network.notice?.message).toMatch(/not enabled yet/)
    await waitFor(() => expect(hook.result.current.wallet.balance.formatted).toBe('5'))
  })

  it('reacts to a network change made in the wallet', async () => {
    const events: RetryWalletEvent[] = []
    const { hook, connect, provider } = setup({}, (event) => events.push(event))
    await connect()
    await waitFor(() => expect(hook.result.current.wallet.balance.formatted).toBe('0.0234'))
    act(() => provider.changeChain(42161))
    await waitFor(() => expect(hook.result.current.wallet.network.scenario).toBe('wrong-network'))
    expect(hook.result.current.wallet.networkName).toBe('Arbitrum One')
    expect(hook.result.current.wallet.balance.value).toBeUndefined()
    act(() => provider.changeChain(8453))
    await waitFor(() => expect(hook.result.current.wallet.balance.formatted).toBe('5'))
    expect(events.filter((event) => event.type === 'network-changed')).toHaveLength(2)
  })

  it('targets Base in production', async () => {
    const { hook, connect } = setup({ defaultChain: 'base', wallet: { chainId: 84532 } })
    await connect()
    expect(hook.result.current.wallet.network.scenario).toBe('supported')
    expect(hook.result.current.wallet.network.switchLabel).toBe('Switch to Base')
  })
})

describe('account changes and session end', () => {
  it('follows an account switch and never shows the previous account balance', async () => {
    const events: RetryWalletEvent[] = []
    const { hook, connect, provider } = setup({}, (event) => events.push(event))
    await connect()
    await waitFor(() => expect(hook.result.current.wallet.balance.formatted).toBe('0.0234'))

    act(() => provider.changeAccounts([BOB]))
    await waitFor(() => expect(hook.result.current.wallet.address).toBe(BOB))
    expect(hook.result.current.wallet.balance.value).not.toBe(ALICE_SEPOLIA)
    await waitFor(() => expect(hook.result.current.wallet.balance.formatted).toBe('2'))
    expect(events).toContainEqual(expect.objectContaining({ type: 'account-changed', from: ALICE, to: BOB }))
  })

  it('disconnects on request', async () => {
    const { hook, connect } = setup()
    await connect()
    act(() => hook.result.current.actions.disconnect())
    await waitFor(() => expect(hook.result.current.wallet.status).toBe('disconnected'))
    expect(hook.result.current.wallet.balance.status).toBe('disconnected')
  })

  it('disconnects when the wallet ends the session', async () => {
    const events: RetryWalletEvent[] = []
    const { hook, connect, provider } = setup({}, (event) => events.push(event))
    await connect()
    act(() => provider.endSession())
    await waitFor(() => expect(hook.result.current.wallet.status).toBe('disconnected'))
    expect(events.at(-1)?.type).toBe('disconnected')
  })
})

describe('balance failures', () => {
  it('shows an explicit error instead of a number when the RPC fails', async () => {
    const { hook, connect, rpc } = setup()
    rpc.failure = () => new HttpRequestError({ url: 'https://sepolia.base.org', status: 503 })
    await connect()
    await waitFor(() => expect(hook.result.current.wallet.balance.status).toBe('error'))
    const { balance } = hook.result.current.wallet
    expect(balance.value).toBeUndefined()
    expect(balance.display).toBeUndefined()
    expect(balance.error?.message).toBe('Unable to fetch your balance.')
    expect(balance.error?.hint).toMatch(/unavailable/)
  })

  it('recovers on manual refresh', async () => {
    const { hook, connect, rpc } = setup()
    rpc.failure = () => new HttpRequestError({ url: 'https://sepolia.base.org', status: 429 })
    await connect()
    await waitFor(() => expect(hook.result.current.wallet.balance.status).toBe('error'))
    expect(hook.result.current.wallet.balance.error?.hint).toMatch(/busy/)
    rpc.failure = undefined
    act(() => hook.result.current.wallet.balance.refetch())
    await waitFor(() => expect(hook.result.current.wallet.balance.formatted).toBe('0.0234'))
  })

  it('polls with the configured interval', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { hook, connect, rpcCalls } = setup()
      await connect()
      await waitFor(() => expect(hook.result.current.wallet.balance.status).toBe('success'))
      const reads = () => rpcCalls.filter(isBalanceRead).length
      const before = reads()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(29_000)
      })
      expect(reads()).toBe(before)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      await waitFor(() => expect(reads()).toBe(before + 1))
    } finally {
      vi.useRealTimers()
    }
  })
})
