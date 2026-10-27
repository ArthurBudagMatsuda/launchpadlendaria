import { test as base, expect, type Page } from '@playwright/test'
import {
  type Address,
  decodeFunctionData,
  encodeFunctionResult,
  getAddress,
  type Hex,
  multicall3Abi,
  numberToHex,
} from 'viem'

export const ALICE = getAddress('0x84a2c0b2e6dc6e1f2c3a4b5d6e7f8091a2b33f91')
export const BOB = getAddress('0x1111111111111111111111111111111111111111')

export interface WalletSetup {
  accounts?: Address[]
  chainId?: number
  rejectConnect?: boolean
  rejectSwitch?: boolean
  /** Never answer the connection request, like Phantom on a Solana-only account. */
  ignoreConnect?: boolean
}

/**
 * Browser-side mock wallet: an EIP-1193 provider exposed both as
 * window.ethereum and through EIP-6963, like a real extension. Authorization
 * survives reloads via sessionStorage so session restore can be tested.
 */
function installMockWallet(setup: Required<WalletSetup>) {
  const KEY = '__retryMockWallet'
  const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as {
    authorized: boolean
    chainId: number
    accounts: string[]
  } | null
  const state = {
    accounts: saved?.accounts ?? setup.accounts,
    chainId: saved?.chainId ?? setup.chainId,
    authorized: saved?.authorized ?? false,
    rejectConnect: setup.rejectConnect,
    rejectSwitch: setup.rejectSwitch,
    ignoreConnect: setup.ignoreConnect,
    calls: [] as string[],
  }
  const persist = () =>
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ authorized: state.authorized, chainId: state.chainId, accounts: state.accounts }),
    )
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
  const emit = (event: string, ...args: unknown[]) => {
    for (const listener of listeners[event] ?? []) listener(...args)
  }
  const hex = (value: number) => `0x${value.toString(16)}`
  const rpcError = (code: number, message: string) => Object.assign(new Error(message), { code })

  const provider = {
    async request({ method, params }: { method: string; params?: unknown[] }) {
      state.calls.push(method)
      switch (method) {
        case 'eth_chainId':
          return hex(state.chainId)
        case 'net_version':
          return String(state.chainId)
        case 'eth_accounts':
          return state.authorized ? state.accounts : []
        case 'eth_requestAccounts':
        case 'wallet_requestPermissions':
          if (state.rejectConnect) throw rpcError(4001, 'User rejected the request.')
          if (state.ignoreConnect) return new Promise(() => {})
          state.authorized = true
          persist()
          return method === 'eth_requestAccounts'
            ? state.accounts
            : [{ parentCapability: 'eth_accounts', caveats: [{ type: 'restrictReturnedAccounts', value: state.accounts }] }]
        case 'wallet_revokePermissions':
          state.authorized = false
          persist()
          return null
        case 'wallet_switchEthereumChain': {
          if (state.rejectSwitch) throw rpcError(4001, 'User rejected the request.')
          const target = Number((params?.[0] as { chainId: string }).chainId)
          state.chainId = target
          persist()
          emit('chainChanged', hex(target))
          return null
        }
        default:
          throw rpcError(4200, `Unsupported method ${method}`)
      }
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      listeners[event] = [...(listeners[event] ?? []), listener]
    },
    removeListener(event: string, listener: (...args: unknown[]) => void) {
      listeners[event] = (listeners[event] ?? []).filter((item) => item !== listener)
    },
  }

  Object.assign(window, {
    ethereum: provider,
    __retryMockWallet: {
      state,
      changeChain(chainId: number) {
        state.chainId = chainId
        persist()
        emit('chainChanged', hex(chainId))
      },
      changeAccounts(accounts: string[]) {
        state.accounts = accounts
        persist()
        emit('accountsChanged', accounts)
      },
      endSession() {
        state.authorized = false
        persist()
        emit('accountsChanged', [])
      },
    },
  })

  const info = {
    uuid: '6f1c2b8e-7d3a-4c1e-9b2f-0a5d4e3c2b1a',
    name: 'Retry Test Wallet',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"%3E%3Crect width="32" height="32" rx="8" fill="%23845ef7"/%3E%3C/svg%3E',
    rdns: 'io.retry.testwallet',
  }
  const announce = () =>
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }))
  window.addEventListener('eip6963:requestProvider', announce)
  announce()
}

export interface RpcMock {
  /** Wei balances per chain and lowercase address. */
  balances: Record<number, Record<string, bigint>>
  /** When set, every RPC call answers with this HTTP status. */
  failStatus: number | undefined
  calls: { chainId: number; method: string }[]
}

function answerMulticall(data: Hex, balanceOf: (address: Address) => bigint): Hex {
  const decoded = decodeFunctionData({ abi: multicall3Abi, data })
  if (decoded.functionName === 'getEthBalance') {
    const [address] = decoded.args as readonly [Address]
    return encodeFunctionResult({ abi: multicall3Abi, functionName: 'getEthBalance', result: balanceOf(address) })
  }
  const [calls] = decoded.args as readonly [readonly { callData: Hex }[]]
  return encodeFunctionResult({
    abi: multicall3Abi,
    functionName: 'aggregate3',
    result: calls.map(({ callData }) => ({ success: true, returnData: answerMulticall(callData, balanceOf) })),
  })
}

const RPC_HOSTS: Record<string, number> = { 'sepolia.base.org': 84532, 'mainnet.base.org': 8453 }

async function mockRpc(page: Page, rpc: RpcMock) {
  await page.route(/^https:\/\/(sepolia|mainnet)\.base\.org/, async (route) => {
    const chainId = RPC_HOSTS[new URL(route.request().url()).hostname] ?? 0
    if (rpc.failStatus) return route.fulfill({ status: rpc.failStatus, body: 'unavailable' })
    const payload = route.request().postDataJSON() as
      | { id: number; method: string; params: unknown[] }
      | { id: number; method: string; params: unknown[] }[]
    const answer = ({ id, method, params }: { id: number; method: string; params: unknown[] }) => {
      rpc.calls.push({ chainId, method })
      const balanceOf = (address: Address) => rpc.balances[chainId]?.[address.toLowerCase()] ?? 0n
      switch (method) {
        case 'eth_chainId':
          return { jsonrpc: '2.0', id, result: numberToHex(chainId) }
        case 'eth_blockNumber':
          return { jsonrpc: '2.0', id, result: '0x1234' }
        case 'eth_getBalance':
          return { jsonrpc: '2.0', id, result: numberToHex(balanceOf(params[0] as Address)) }
        case 'eth_call':
          return { jsonrpc: '2.0', id, result: answerMulticall((params[0] as { data: Hex }).data, balanceOf) }
        default:
          return { jsonrpc: '2.0', id, error: { code: -32601, message: 'method not found' } }
      }
    }
    const body = Array.isArray(payload) ? payload.map(answer) : answer(payload)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

export const test = base.extend<{
  wallet: (setup?: WalletSetup) => Promise<void>
  rpc: RpcMock
  externalRequests: string[]
}>({
  externalRequests: async ({ page }, use) => {
    const external: string[] = []
    // Keep tests hermetic: anything that is not the app or the mocked RPC is blocked and recorded.
    await page.route(
      (url) => !['localhost', '127.0.0.1', 'sepolia.base.org', 'mainnet.base.org'].includes(url.hostname),
      (route) => {
        external.push(new URL(route.request().url()).hostname)
        return route.abort()
      },
    )
    await use(external)
  },
  rpc: async ({ page, externalRequests: _blocked }, use) => {
    const rpc: RpcMock = {
      balances: {
        84532: { [ALICE.toLowerCase()]: 23_400_000_000_000_000n, [BOB.toLowerCase()]: 2n * 10n ** 18n },
        8453: { [ALICE.toLowerCase()]: 5n * 10n ** 18n },
      },
      failStatus: undefined,
      calls: [],
    }
    await mockRpc(page, rpc)
    await use(rpc)
  },
  wallet: async ({ page, rpc: _rpc }, use) => {
    await use(async (setup = {}) => {
      await page.addInitScript(installMockWallet, {
        accounts: setup.accounts ?? [ALICE, BOB],
        chainId: setup.chainId ?? 84532,
        rejectConnect: setup.rejectConnect ?? false,
        rejectSwitch: setup.rejectSwitch ?? false,
        ignoreConnect: setup.ignoreConnect ?? false,
      })
    })
  },
})

export { expect }

export const short = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`

export async function connectTestWallet(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Connect Wallet' }).click()
  const dialog = page.getByRole('dialog', { name: 'Connect Wallet' })
  await dialog.getByRole('button', { name: /Retry Test Wallet/ }).click()
  await expect(dialog).toBeHidden()
}
