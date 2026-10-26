'use client'

import { useCallback, useMemo, useState } from 'react'
import { type Connector, useConnect, useConnectors, useDisconnect } from 'wagmi'
import { RETRY_CONNECTOR_IDS } from '../../config/connectors.js'
import { RetryWeb3Error, toRetryWeb3Error } from '../../lib/errors.js'
import { logWeb3Diagnostic } from '../../lib/logger.js'
import { useRetryNetwork } from './useRetryNetwork.js'

export type RetryActionStatus = 'idle' | 'pending' | 'success' | 'error'

export interface RetryWalletActions {
  /**
   * Starts a connection with a connector (object, uid or id). The connection
   * only counts as established once the connector confirms it; read the
   * result from `useRetryWallet().isConnected`, not from this call.
   */
  connect: (connector: Connector | string) => void
  connectStatus: RetryActionStatus
  connectError: RetryWeb3Error | undefined
  /** uid of the connector currently waiting for the wallet, if any. */
  pendingConnectorUid: string | undefined
  disconnect: () => void
  disconnectStatus: RetryActionStatus
  disconnectError: RetryWeb3Error | undefined
  switchToTarget: () => void
  switchTo: ReturnType<typeof useRetryNetwork>['switchTo']
  switchStatus: RetryActionStatus
  switchError: RetryWeb3Error | undefined
  /** Clears connect / disconnect / switch errors. */
  reset: () => void
}

function pendingUid(connector: unknown): string | undefined {
  if (connector && typeof connector === 'object' && 'uid' in connector && typeof connector.uid === 'string') {
    return connector.uid
  }
  return undefined
}

export function useRetryWalletActions(): RetryWalletActions {
  const connectMutation = useConnect()
  const disconnectMutation = useDisconnect()
  const connectors = useConnectors()
  const network = useRetryNetwork()
  const [localError, setLocalError] = useState<RetryWeb3Error | undefined>()

  const { mutate: connectMutate, reset: resetConnect } = connectMutation
  const { mutate: disconnectMutate, reset: resetDisconnect } = disconnectMutation

  const connect = useCallback(
    (target: Connector | string) => {
      setLocalError(undefined)
      const connector =
        typeof target === 'string'
          ? connectors.find((item) => item.uid === target || item.id === target)
          : target
      if (!connector) {
        const code =
          target === RETRY_CONNECTOR_IDS.walletConnect
            ? 'WALLETCONNECT_NOT_CONFIGURED'
            : 'WALLET_NOT_INSTALLED'
        setLocalError(new RetryWeb3Error(code))
        return
      }
      // No `chainId` here on purpose: switching networks is a separate,
      // explicit user action.
      connectMutate(
        { connector },
        { onError: (error) => logWeb3Diagnostic(`connect via ${connector.name} failed`, error) },
      )
    },
    [connectors, connectMutate],
  )

  const disconnect = useCallback(() => {
    disconnectMutate(undefined, {
      onError: (error) => logWeb3Diagnostic('disconnect failed', error),
    })
  }, [disconnectMutate])

  const { resetSwitch } = network
  const reset = useCallback(() => {
    setLocalError(undefined)
    resetConnect()
    resetDisconnect()
    resetSwitch()
  }, [resetConnect, resetDisconnect, resetSwitch])

  const connectError = useMemo(
    () =>
      localError ??
      (connectMutation.error ? toRetryWeb3Error(connectMutation.error, { context: 'connect' }) : undefined),
    [localError, connectMutation.error],
  )
  const disconnectError = useMemo(
    () =>
      disconnectMutation.error
        ? toRetryWeb3Error(disconnectMutation.error, { context: 'disconnect' })
        : undefined,
    [disconnectMutation.error],
  )

  return {
    connect,
    connectStatus: localError ? 'error' : connectMutation.status,
    connectError,
    pendingConnectorUid: connectMutation.isPending
      ? pendingUid(connectMutation.variables?.connector)
      : undefined,
    disconnect,
    disconnectStatus: disconnectMutation.status,
    disconnectError,
    switchToTarget: network.switchToTarget,
    switchTo: network.switchTo,
    switchStatus: network.switchStatus,
    switchError: network.switchError,
    reset,
  }
}
