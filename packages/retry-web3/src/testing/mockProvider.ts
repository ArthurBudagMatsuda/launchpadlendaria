import { type Address, getAddress, numberToHex } from 'viem'
import { type CreateConnectorFn, injected } from 'wagmi'

/**
 * Deterministic EIP-1193 wallet for automated tests. It speaks the same JSON-RPC
 * methods and events as a browser extension, so tests exercise wagmi's real
 * `injected` connector code path.
 *
 * It is NOT evidence that MetaMask, Coinbase Wallet or WalletConnect work;
 * those must be verified manually (see docs/web3/WALLET_INTEGRATION.md).
 */
export interface MockWalletOptions {
  accounts?: Address[]
  chainId?: number
  /** Reject `eth_requestAccounts` / `wallet_requestPermissions` with code 4001. */
  rejectConnect?: boolean
  /**
   * Never answer `eth_requestAccounts` / `wallet_requestPermissions`, like a
   * wallet whose prompt was closed without a reply (Phantom on a Solana-only
   * account). `approvePendingConnect()` answers them later.
   */
  ignoreConnect?: boolean
  /** Reject `wallet_switchEthereumChain` with code 4001. */
  rejectSwitch?: boolean
  /** Chains the wallet already knows. Switching elsewhere first fails with 4902. Default: all. */
  knownChainIds?: number[] | undefined
  /** Reject `wallet_addEthereumChain` with code 4001. */
  rejectAddChain?: boolean
}

type Listener = (...args: unknown[]) => void

export interface MockEip1193Provider {
  request(args: { method: string; params?: unknown }): Promise<unknown>
  on(event: string, listener: Listener): void
  removeListener(event: string, listener: Listener): void
  /** Every request received, in order. */
  readonly calls: { method: string; params: unknown }[]
  /** Mutable behaviour switches. */
  readonly options: MockWalletOptions
  readonly state: { accounts: Address[]; chainId: number; authorized: boolean }
  /** Simulates the user picking another account in the wallet. */
  changeAccounts(accounts: Address[]): void
  /** Simulates the user switching network in the wallet UI. */
  changeChain(chainId: number): void
  /** Simulates the wallet ending the session. */
  endSession(): void
  /** Approves the connection requests held by `ignoreConnect`. */
  approvePendingConnect(): void
}

/** Test-only addresses with no known owner. Never fund them. */
export const MOCK_WALLET_ACCOUNTS: readonly [Address, Address] = [
  getAddress('0x84a2c0b2e6dc6e1f2c3a4b5d6e7f8091a2b33f91'),
  getAddress('0x1111111111111111111111111111111111111111'),
]

function rpcError(code: number, message: string): Error & { code: number } {
  return Object.assign(new Error(message), { code })
}

export function createMockEip1193Provider(options: MockWalletOptions = {}): MockEip1193Provider {
  const listeners = new Map<string, Set<Listener>>()
  const opts: MockWalletOptions = { ...options }
  const state = {
    accounts: (options.accounts ?? [...MOCK_WALLET_ACCOUNTS]).map((a) => getAddress(a)),
    chainId: options.chainId ?? 84532,
    authorized: false,
  }
  const known = new Set(options.knownChainIds ?? [])
  const knowsChain = (id: number) => opts.knownChainIds === undefined || known.has(id) || id === state.chainId
  const calls: { method: string; params: unknown }[] = []
  const heldConnects: (() => void)[] = []

  const emit = (event: string, ...args: unknown[]) => {
    for (const listener of listeners.get(event) ?? []) listener(...args)
  }

  const provider: MockEip1193Provider = {
    calls,
    options: opts,
    state,
    async request({ method, params }) {
      calls.push({ method, params })
      switch (method) {
        case 'eth_chainId':
          return numberToHex(state.chainId)
        case 'net_version':
          return String(state.chainId)
        case 'eth_accounts':
          return state.authorized ? [...state.accounts] : []
        case 'eth_requestAccounts':
        case 'wallet_requestPermissions': {
          if (opts.rejectConnect) throw rpcError(4001, 'User rejected the request.')
          const approve = () => {
            state.authorized = true
            return method === 'eth_requestAccounts'
              ? [...state.accounts]
              : [
                  {
                    parentCapability: 'eth_accounts',
                    caveats: [{ type: 'restrictReturnedAccounts', value: [...state.accounts] }],
                  },
                ]
          }
          if (opts.ignoreConnect) return new Promise((resolve) => heldConnects.push(() => resolve(approve())))
          return approve()
        }
        case 'wallet_revokePermissions':
          state.authorized = false
          return null
        case 'wallet_switchEthereumChain': {
          const [{ chainId }] = params as [{ chainId: string }]
          const id = Number(chainId)
          if (opts.rejectSwitch) throw rpcError(4001, 'User rejected the request.')
          if (!knowsChain(id)) throw rpcError(4902, 'Unrecognized chain ID.')
          if (id !== state.chainId) {
            state.chainId = id
            emit('chainChanged', numberToHex(id))
          }
          return null
        }
        case 'wallet_addEthereumChain': {
          const [{ chainId }] = params as [{ chainId: string }]
          const id = Number(chainId)
          if (opts.rejectAddChain) throw rpcError(4001, 'User rejected the request.')
          known.add(id)
          if (id !== state.chainId) {
            state.chainId = id
            emit('chainChanged', numberToHex(id))
          }
          return null
        }
        case 'personal_sign':
        case 'eth_sign':
        case 'eth_signTypedData_v4':
        case 'eth_sendTransaction':
        case 'eth_signTransaction':
          // Stage 2 must never reach these; fail loudly if it does.
          throw rpcError(4200, `Mock wallet refuses ${method}: not allowed in Stage 2.`)
        default:
          throw rpcError(4200, `Mock wallet does not support ${method}.`)
      }
    },
    on(event, listener) {
      const set = listeners.get(event) ?? new Set()
      set.add(listener)
      listeners.set(event, set)
    },
    removeListener(event, listener) {
      listeners.get(event)?.delete(listener)
    },
    changeAccounts(accounts) {
      state.accounts = accounts.map((a) => getAddress(a))
      emit('accountsChanged', [...state.accounts])
    },
    changeChain(chainId) {
      state.chainId = chainId
      emit('chainChanged', numberToHex(chainId))
    },
    endSession() {
      state.authorized = false
      emit('accountsChanged', [])
    },
    approvePendingConnect() {
      for (const answer of heldConnects.splice(0)) answer()
    },
  }
  return provider
}

/** wagmi connector bound to a {@link MockEip1193Provider}. */
export function mockWalletConnector(
  provider: MockEip1193Provider,
  info: { id?: string; name?: string } = {},
): CreateConnectorFn {
  return injected({
    shimDisconnect: true,
    target: () => ({
      id: info.id ?? 'mockWallet',
      name: info.name ?? 'Mock Wallet',
      provider: provider as never,
    }),
  })
}
