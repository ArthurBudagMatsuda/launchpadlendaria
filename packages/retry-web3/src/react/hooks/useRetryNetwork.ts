'use client'

import { useIsMutating } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { useConnection, useSwitchChain } from 'wagmi'
import {
  getChainDisplayName,
  getRetryNetwork,
  RETRY_NETWORKS,
  type RetryNetworkInfo,
  type RetrySupportedChainId,
} from '../../config/chains.js'
import { RETRY_FINANCIAL_OPERATIONS_ENABLED } from '../../config/wagmi.js'
import { type RetryWeb3Error, toRetryWeb3Error } from '../../lib/errors.js'
import { logWeb3Diagnostic } from '../../lib/logger.js'
import { useRetryWeb3Settings } from '../context.js'

/**
 * - `disconnected`: no wallet.
 * - `target`: wallet is on the network the app targets (Base Sepolia in development).
 * - `supported`: wallet is on the other Base network (valid, read-only).
 * - `wrong-network`: wallet is on any other chain.
 */
export type RetryNetworkScenario = 'disconnected' | 'target' | 'supported' | 'wrong-network'

export interface RetryNetworkNotice {
  tone: 'success' | 'info' | 'warning' | 'error'
  title: string
  message: string
}

export type RetrySwitchStatus = 'idle' | 'pending' | 'success' | 'error'

export interface RetryNetworkState {
  scenario: RetryNetworkScenario
  /** Chain ID reported by the wallet right now. Not the app's configured chain. */
  walletChainId: number | undefined
  /** Supported network the wallet is on, if any. */
  walletNetwork: RetryNetworkInfo | undefined
  /** Display name of the wallet's chain, including unsupported chains ("Ethereum"). */
  walletNetworkName: string | undefined
  targetNetwork: RetryNetworkInfo
  isSupported: boolean
  isOnTarget: boolean
  isWrongNetwork: boolean
  /** `Switch to Base Sepolia` in development, `Switch to Base` in production. */
  switchLabel: string
  notice: RetryNetworkNotice | undefined
  /** Always false in Stage 2. Gate buy/sell/create buttons on this. */
  financialOperationsEnabled: boolean
  /** Whether the connected wallet exposes programmatic network switching. */
  canSwitch: boolean
  switchStatus: RetrySwitchStatus
  /** True while any network switch started from this app is waiting for the wallet. */
  isSwitching: boolean
  switchError: RetryWeb3Error | undefined
  /** Must be called from a user gesture (click). Never switches on its own. */
  switchToTarget: () => void
  switchTo: (chainId: RetrySupportedChainId) => void
  resetSwitch: () => void
}

function buildNotice(
  scenario: RetryNetworkScenario,
  wallet: RetryNetworkInfo | undefined,
  walletName: string | undefined,
  target: RetryNetworkInfo,
): RetryNetworkNotice | undefined {
  switch (scenario) {
    case 'disconnected':
      return undefined
    case 'wrong-network':
      return {
        tone: 'error',
        title: 'Wrong Network',
        message: `Your wallet is on ${walletName ?? 'an unsupported network'}. Please switch to ${target.name}.`,
      }
    case 'target':
      return wallet?.isTestnet
        ? {
            tone: 'success',
            title: wallet.name,
            message: `Connected to ${wallet.name}, the development network.`,
          }
        : {
            tone: 'info',
            title: wallet?.name ?? target.name,
            message: 'Connected to Base. Trading and token launches are not enabled yet.',
          }
    case 'supported':
      return wallet?.isTestnet
        ? {
            tone: 'warning',
            title: wallet.name,
            message: `Connected to ${wallet.name}, a test network. Switch to ${target.name} to use RETRY.`,
          }
        : {
            tone: 'info',
            title: wallet?.name ?? 'Base',
            message: 'Connected to Base Mainnet (read-only). Trading and token launches are not enabled yet.',
          }
  }
}

export function useRetryNetwork(): RetryNetworkState {
  const settings = useRetryWeb3Settings()
  const connection = useConnection()
  const switchChain = useSwitchChain()
  const pendingSwitches = useIsMutating({ mutationKey: ['switchChain'] })

  const targetNetwork = RETRY_NETWORKS[settings.targetChainId]
  const walletChainId = connection.isConnected ? connection.chainId : undefined
  const walletNetwork = getRetryNetwork(walletChainId)
  const walletNetworkName = walletChainId === undefined ? undefined : getChainDisplayName(walletChainId)

  let scenario: RetryNetworkScenario = 'disconnected'
  if (connection.isConnected && walletChainId !== undefined) {
    if (!walletNetwork) scenario = 'wrong-network'
    else scenario = walletNetwork.id === targetNetwork.id ? 'target' : 'supported'
  }

  const { reset, mutate } = switchChain
  // A switch done in the wallet itself makes any previous switch error stale.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the active chain changes
  useEffect(() => {
    reset()
  }, [walletChainId, reset])

  const switchTo = useCallback(
    (chainId: RetrySupportedChainId) => {
      if (!connection.isConnected) return
      mutate(
        { chainId },
        {
          onError: (error) => logWeb3Diagnostic('switch chain failed', error),
        },
      )
    },
    [connection.isConnected, mutate],
  )

  const switchToTarget = useCallback(() => switchTo(targetNetwork.id), [switchTo, targetNetwork.id])

  const switchError = useMemo(
    () =>
      switchChain.error
        ? toRetryWeb3Error(switchChain.error, {
            context: 'switch-chain',
            targetNetworkName: targetNetwork.name,
          })
        : undefined,
    [switchChain.error, targetNetwork.name],
  )

  return {
    scenario,
    walletChainId,
    walletNetwork,
    walletNetworkName,
    targetNetwork,
    isSupported: walletNetwork !== undefined,
    isOnTarget: scenario === 'target',
    isWrongNetwork: scenario === 'wrong-network',
    switchLabel: `Switch to ${targetNetwork.name}`,
    notice: buildNotice(scenario, walletNetwork, walletNetworkName, targetNetwork),
    financialOperationsEnabled: RETRY_FINANCIAL_OPERATIONS_ENABLED,
    canSwitch: Boolean(connection.isConnected && connection.connector?.switchChain),
    switchStatus: switchChain.status,
    isSwitching: switchChain.isPending || pendingSwitches > 0,
    switchError,
    switchToTarget,
    switchTo,
    resetSwitch: reset,
  }
}
