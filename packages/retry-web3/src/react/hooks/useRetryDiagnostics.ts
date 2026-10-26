'use client'

import { useCallback, useState } from 'react'
import { useConfig, useConnection, useConnectors } from 'wagmi'
import { getBlockNumber } from 'wagmi/actions'
import type { RetrySupportedChainId } from '../../config/chains.js'
import type { RetryWeb3Settings } from '../../config/wagmi.js'
import { type RetryWeb3Error, toRetryWeb3Error } from '../../lib/errors.js'
import { useRetryWeb3Settings } from '../context.js'
import { type Eip6963WalletInfo, useEip6963Wallets } from '../eip6963.js'

export type RpcHealth =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok'; blockNumber: bigint; latencyMs: number; checkedAt: number }
  | { status: 'error'; error: RetryWeb3Error; latencyMs: number; checkedAt: number }

export interface RetryDiagnostics {
  settings: RetryWeb3Settings
  connectionStatus: string
  connectorId: string | undefined
  connectorType: string | undefined
  walletChainId: number | undefined
  connectors: { uid: string; id: string; name: string; type: string; rdns: string | undefined }[]
  announcedWallets: readonly Eip6963WalletInfo[]
  rpcHealth: Record<RetrySupportedChainId, RpcHealth>
  /** One `eth_blockNumber` call through the configured transports. */
  checkRpc: (chainId: RetrySupportedChainId) => Promise<void>
}

const IDLE: RpcHealth = { status: 'idle' }

/** Connection internals for a debug panel. Contains no secrets (RPC URLs are reduced to origins). */
export function useRetryDiagnostics(): RetryDiagnostics {
  const settings = useRetryWeb3Settings()
  const config = useConfig()
  const connection = useConnection()
  const connectors = useConnectors()
  const announcedWallets = useEip6963Wallets()
  const [rpcHealth, setRpcHealth] = useState<Record<RetrySupportedChainId, RpcHealth>>({
    8453: IDLE,
    84532: IDLE,
  })

  const checkRpc = useCallback(
    async (chainId: RetrySupportedChainId) => {
      setRpcHealth((current) => ({ ...current, [chainId]: { status: 'checking' } }))
      const started = performance.now()
      try {
        const blockNumber = await getBlockNumber(config, { chainId, cacheTime: 0 })
        const latencyMs = Math.round(performance.now() - started)
        setRpcHealth((current) => ({
          ...current,
          [chainId]: { status: 'ok', blockNumber, latencyMs, checkedAt: Date.now() },
        }))
      } catch (error) {
        const latencyMs = Math.round(performance.now() - started)
        setRpcHealth((current) => ({
          ...current,
          [chainId]: {
            status: 'error',
            error: toRetryWeb3Error(error, { context: 'read' }),
            latencyMs,
            checkedAt: Date.now(),
          },
        }))
      }
    },
    [config],
  )

  return {
    settings,
    connectionStatus: connection.status,
    connectorId: connection.connector?.id,
    connectorType: connection.connector?.type,
    walletChainId: connection.chainId,
    connectors: connectors.map((connector) => ({
      uid: connector.uid,
      id: connector.id,
      name: connector.name,
      type: connector.type,
      rdns: Array.isArray(connector.rdns)
        ? connector.rdns.join(', ')
        : (connector.rdns as string | undefined),
    })),
    announcedWallets,
    rpcHealth,
    checkRpc,
  }
}
