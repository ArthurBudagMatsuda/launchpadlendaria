'use client'

import { useEffect, useRef } from 'react'
import { useConnection } from 'wagmi'
import type { Address } from '../../lib/address.js'

export type RetryWalletEvent =
  | { type: 'connected'; address: Address; chainId: number; connectorName: string; at: number }
  | { type: 'disconnected'; at: number }
  | { type: 'account-changed'; from: Address; to: Address; at: number }
  | { type: 'network-changed'; from: number; to: number; at: number }

interface Snapshot {
  connected: boolean
  address: Address | undefined
  chainId: number | undefined
}

/**
 * Calls `handler` when the wallet connects, disconnects, switches account or
 * switches network (including changes made directly in the wallet). Use it to
 * drop per-account UI state, e.g. a pending form, when the account changes.
 */
export function useRetryWalletEvents(handler: (event: RetryWalletEvent) => void): void {
  const connection = useConnection()
  const handlerRef = useRef(handler)
  // Declared before the event effect so it always sees the latest handler.
  useEffect(() => {
    handlerRef.current = handler
  })
  const previous = useRef<Snapshot | undefined>(undefined)

  const connected = connection.status === 'connected'
  const address = connected ? connection.address : undefined
  const chainId = connected ? connection.chainId : undefined
  const connectorName = connected ? connection.connector.name : undefined

  useEffect(() => {
    const before = previous.current
    previous.current = { connected, address, chainId }
    if (!before) {
      // First render: report an already established session once.
      if (connected && address && chainId !== undefined) {
        handlerRef.current({
          type: 'connected',
          address,
          chainId,
          connectorName: connectorName ?? '',
          at: Date.now(),
        })
      }
      return
    }
    const at = Date.now()
    if (!before.connected && connected && address && chainId !== undefined) {
      handlerRef.current({ type: 'connected', address, chainId, connectorName: connectorName ?? '', at })
      return
    }
    if (before.connected && !connected) {
      handlerRef.current({ type: 'disconnected', at })
      return
    }
    if (!connected) return
    if (before.address && address && before.address !== address) {
      handlerRef.current({ type: 'account-changed', from: before.address, to: address, at })
    }
    if (before.chainId !== undefined && chainId !== undefined && before.chainId !== chainId) {
      handlerRef.current({ type: 'network-changed', from: before.chainId, to: chainId, at })
    }
  }, [connected, address, chainId, connectorName])
}
