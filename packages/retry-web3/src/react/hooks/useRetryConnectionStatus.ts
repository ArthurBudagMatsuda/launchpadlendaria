'use client'

import { useConnection } from 'wagmi'

export type RetryConnectionStatus = 'disconnected' | 'connecting' | 'reconnecting' | 'connected'

export interface RetryConnectionStatusState {
  status: RetryConnectionStatus
  /** True once the connector confirmed the connection (also while silently reconnecting). */
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  isDisconnected: boolean
}

/** Connection lifecycle only. Cheap to use in many components. */
export function useRetryConnectionStatus(): RetryConnectionStatusState {
  const connection = useConnection()
  return {
    status: connection.status,
    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting,
    isReconnecting: connection.isReconnecting,
    isDisconnected: connection.isDisconnected,
  }
}
