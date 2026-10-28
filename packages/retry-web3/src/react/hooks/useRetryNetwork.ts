'use client'

import { useIsMutating } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Config, useConfig, useConnection, useSwitchChain } from 'wagmi'
import {
  getChainDisplayName,
  getRetryNetwork,
  RETRY_NETWORKS,
  type RetryNetworkInfo,
  type RetrySupportedChainId,
} from '../../config/chains.js'
import { RETRY_FINANCIAL_OPERATIONS_ENABLED } from '../../config/wagmi.js'
import { RetryWeb3Error, toRetryWeb3Error } from '../../lib/errors.js'
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

/**
 * How long the wallet must stay on the requested network after it confirms a
 * switch. Some wallets confirm and then go back to the network selected in
 * the wallet itself: Phantom does it within milliseconds.
 */
export const RETRY_SWITCH_SETTLE_MS = 1_500

function activeChainId(config: Config): number | undefined {
  const { status, current, connections } = config.state
  if (status !== 'connected' || !current) return undefined
  return connections.get(current)?.chainId
}

/** Waits until the wallet leaves `chainId` or `ms` pass, then reports where it is. */
function settledChainId(config: Config, chainId: number, ms: number): Promise<number | undefined> {
  return new Promise((resolve) => {
    let stop = () => {}
    const finish = () => {
      clearTimeout(timer)
      stop()
      resolve(activeChainId(config))
    }
    const timer = setTimeout(finish, ms)
    stop = config.subscribe(
      () => activeChainId(config),
      (next) => {
        if (next !== chainId) finish()
      },
    )
  })
}

function switchNotApplied(options: {
  walletName: string | undefined
  reachedTarget: boolean
  currentNetworkName: string
  targetNetworkName: string
}): RetryWeb3Error {
  const { walletName, reachedTarget, currentNetworkName, targetNetworkName } = options
  const subject = walletName ?? 'Your wallet'
  const what = reachedTarget ? `switched back to ${currentNetworkName}` : `stayed on ${currentNetworkName}`
  return new RetryWeb3Error('SWITCH_NOT_APPLIED', {
    message: `${subject} ${what}. Open ${walletName ?? 'your wallet'}, choose ${targetNetworkName} there, and try again.`,
  })
}

export function useRetryNetwork(): RetryNetworkState {
  const settings = useRetryWeb3Settings()
  const config = useConfig()
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

  const { reset, mutateAsync } = switchChain
  // A switch done in the wallet itself makes any previous switch error stale.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the active chain changes
  useEffect(() => {
    reset()
  }, [walletChainId, reset])

  // A confirmed switch only counts once the wallet stays on the new network.
  const [notApplied, setNotApplied] = useState<{ chainId: number; error: RetryWeb3Error } | undefined>()
  const [verifying, setVerifying] = useState(false)
  const attempt = useRef(0)

  const isConnected = connection.isConnected
  const walletName = isConnected ? connection.connector?.name : undefined
  const switchTo = useCallback(
    (chainId: RetrySupportedChainId) => {
      if (!isConnected) return
      const id = ++attempt.current
      setNotApplied(undefined)
      let reachedTarget = activeChainId(config) === chainId
      const stopWatching = config.subscribe(
        () => activeChainId(config),
        (next) => {
          if (next === chainId) reachedTarget = true
        },
      )
      mutateAsync({ chainId })
        .then(async () => {
          if (attempt.current !== id) return
          setVerifying(true)
          const landed = await settledChainId(config, chainId, RETRY_SWITCH_SETTLE_MS)
          if (attempt.current !== id || landed === undefined || landed === chainId) return
          logWeb3Diagnostic('switch chain not kept by the wallet', { chainId, landed, reachedTarget })
          setNotApplied({
            chainId: landed,
            error: switchNotApplied({
              walletName,
              reachedTarget,
              currentNetworkName: getChainDisplayName(landed),
              targetNetworkName: RETRY_NETWORKS[chainId].name,
            }),
          })
        })
        .catch((error: unknown) => logWeb3Diagnostic('switch chain failed', error))
        .finally(() => {
          stopWatching()
          if (attempt.current === id) setVerifying(false)
        })
    },
    [isConnected, config, mutateAsync, walletName],
  )

  const switchToTarget = useCallback(() => switchTo(targetNetwork.id), [switchTo, targetNetwork.id])

  const requestError = useMemo(
    () =>
      switchChain.error
        ? toRetryWeb3Error(switchChain.error, {
            context: 'switch-chain',
            targetNetworkName: targetNetwork.name,
          })
        : undefined,
    [switchChain.error, targetNetwork.name],
  )
  // Shown while the wallet is still on the network it went back to.
  const notAppliedError = notApplied && notApplied.chainId === walletChainId ? notApplied.error : undefined
  const switchError = requestError ?? notAppliedError

  const resetSwitch = useCallback(() => {
    attempt.current += 1
    setNotApplied(undefined)
    setVerifying(false)
    reset()
  }, [reset])

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
    switchStatus: switchError ? 'error' : verifying ? 'pending' : switchChain.status,
    isSwitching: switchChain.isPending || pendingSwitches > 0 || verifying,
    switchError,
    switchToTarget,
    switchTo,
    resetSwitch,
  }
}
