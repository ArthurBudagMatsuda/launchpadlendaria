import { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  type Address,
  custom,
  decodeFunctionData,
  encodeFunctionResult,
  type Hex,
  multicall3Abi,
  numberToHex,
} from 'viem'
import { createRetryWeb3Config } from '../src/config/wagmi.js'
import { RetryWeb3Provider } from '../src/react/provider.js'
import {
  createMockEip1193Provider,
  type MockWalletOptions,
  mockWalletConnector,
} from '../src/testing/index.js'

export interface TestSetupOptions {
  wallet?: MockWalletOptions
  /** Wei balances per chain and lowercase address. */
  balances?: Record<number, Record<string, bigint>>
  defaultChain?: string
  walletConnectProjectId?: string
}

/**
 * Real wagmi config + real injected connector, wired to a mock EIP-1193 wallet
 * and an in-memory JSON-RPC endpoint per chain (no network access).
 */
export function createTestSetup(options: TestSetupOptions = {}) {
  const provider = createMockEip1193Provider(options.wallet)
  const balances = options.balances ?? {}
  const rpcCalls: { chainId: number; method: string; params: unknown }[] = []
  const rpc = { failure: undefined as (() => Error) | undefined }

  const transport = (chainId: number) =>
    custom(
      {
        async request({ method, params }: { method: string; params?: unknown }) {
          rpcCalls.push({ chainId, method, params })
          if (rpc.failure) throw rpc.failure()
          switch (method) {
            case 'eth_getBalance': {
              const [address] = params as [Address]
              return numberToHex(balances[chainId]?.[address.toLowerCase()] ?? 0n)
            }
            case 'eth_call': {
              // wagmi batches reads through Multicall3, including native balances (getEthBalance).
              const [{ data }] = params as [{ to: Address; data: Hex }]
              return answerMulticall(data, (address) => balances[chainId]?.[address.toLowerCase()] ?? 0n)
            }
            case 'eth_blockNumber':
              return '0x10'
            case 'eth_chainId':
              return numberToHex(chainId)
            default:
              throw new Error(`unexpected RPC method ${method}`)
          }
        },
      },
      { retryCount: 0 },
    )

  const config = createRetryWeb3Config({
    env: { defaultChain: options.defaultChain, walletConnectProjectId: options.walletConnectProjectId },
    connectors: [mockWalletConnector(provider)],
    transports: { 8453: transport(8453), 84532: transport(84532) },
    storage: 'none',
    multiInjectedProviderDiscovery: false,
  })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })

  // biome-ignore lint/correctness/noComponentHookFactories: renderHook wrappers must close over the per-test config
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RetryWeb3Provider config={config} queryClient={queryClient} reconnectOnMount={false} debug={false}>
        {children}
      </RetryWeb3Provider>
    )
  }

  return { provider, config, queryClient, Wrapper, rpcCalls, rpc }
}

export const ETH = 10n ** 18n

/** Minimal Multicall3 responder: supports aggregate3 over getEthBalance calls. */
export function answerMulticall(data: Hex, balanceOf: (address: Address) => bigint): Hex {
  const decoded = decodeFunctionData({ abi: multicall3Abi, data })
  if (decoded.functionName === 'getEthBalance') {
    const [address] = decoded.args as readonly [Address]
    return encodeFunctionResult({
      abi: multicall3Abi,
      functionName: 'getEthBalance',
      result: balanceOf(address),
    })
  }
  if (decoded.functionName !== 'aggregate3') throw new Error(`unexpected multicall ${decoded.functionName}`)
  const [calls] = decoded.args as readonly [readonly { callData: Hex }[]]
  const results = calls.map(({ callData }) => ({
    success: true,
    returnData: answerMulticall(callData, balanceOf),
  }))
  return encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: results })
}
