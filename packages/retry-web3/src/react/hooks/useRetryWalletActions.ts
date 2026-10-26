'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { type Connector, useConfig, useConnect, useConnectors, useDisconnect } from 'wagmi'
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
  /**
   * Stops waiting for the wallet and leaves the `connecting` state. The wallet
   * may still show its prompt; if the user approves it later, the connection
   * is recorded as usual.
   */
  cancelConnect: () => void
  disconnect: () => void
  disconnectStatus: RetryActionStatus
  disconnectError: RetryWeb3Error | undefined
  switchToTarget: () => void
  switchTo: ReturnType<typeof useRetryNetwork>['switchTo']
  switchStatus: RetryActionStatus
  switchError: RetryWeb3Error | undefined
  /** Clears connect / disconnect / switch errors and cancels a pending connection. */
  reset: () => void
}

function pendingUid(connector: unknown): string | undefined {
  if (connector && typeof connector === 'object' && 'uid' in connector && typeof connector.uid === 'string') {
    return connector.uid
  }
  return undefined
}

/**
 * How long to keep waiting after the page gets focus back from a browser
 * wallet's window. A wallet that approved or rejected answers well within it.
 */
export const RETRY_WALLET_CLOSED_GRACE_MS = 1_500

/** Browser-extension wallets (EIP-6963 or `window.ethereum`) prompt in their own window. */
function promptsInOwnWindow(connector: unknown): boolean {
  return Boolean(
    connector && typeof connector === 'object' && 'type' in connector && connector.type === 'injected',
  )
}

export function useRetryWalletActions(): RetryWalletActions {
  const config = useConfig()
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

  // wagmi reports `connecting` until the wallet answers, and some wallets never
  // answer once their prompt is closed (Phantom on a Solana-only account shows
  // "unsupported account" and drops the request). Leave that state the way
  // wagmi does when a connection fails. A later answer still connects.
  const releaseConnect = useCallback(() => {
    resetConnect()
    if (config.state.status === 'connecting') {
      config.setState((state) => ({ ...state, status: state.current ? 'connected' : 'disconnected' }))
    }
  }, [config, resetConnect])

  const isConnectPending = connectMutation.isPending
  const cancelConnect = useCallback(() => {
    if (isConnectPending) releaseConnect()
  }, [isConnectPending, releaseConnect])

  // Extension wallets take focus with their own window. When the page gets it
  // back and the request is still open, the wallet was closed without answering.
  const pendingConnector = isConnectPending ? connectMutation.variables?.connector : undefined
  const watchForClosedWallet = promptsInOwnWindow(pendingConnector)
  useEffect(() => {
    if (!watchForClosedWallet) return
    let leftPage = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const onBlur = () => {
      leftPage = true
      clearTimeout(timer)
    }
    const onFocus = () => {
      if (!leftPage) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        logWeb3Diagnostic('wallet closed without answering the connection request')
        releaseConnect()
        setLocalError(new RetryWeb3Error('WALLET_NO_RESPONSE'))
      }, RETRY_WALLET_CLOSED_GRACE_MS)
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [watchForClosedWallet, releaseConnect])

  const disconnect = useCallback(() => {
    disconnectMutate(undefined, {
      onError: (error) => logWeb3Diagnostic('disconnect failed', error),
    })
  }, [disconnectMutate])

  const { resetSwitch } = network
  const reset = useCallback(() => {
    setLocalError(undefined)
    releaseConnect()
    resetDisconnect()
    resetSwitch()
  }, [releaseConnect, resetDisconnect, resetSwitch])

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
    pendingConnectorUid: pendingUid(pendingConnector),
    cancelConnect,
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
