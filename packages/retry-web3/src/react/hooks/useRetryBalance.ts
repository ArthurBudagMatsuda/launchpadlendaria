'use client'

import { useCallback, useMemo } from 'react'
import { useBalance, useConnection } from 'wagmi'
import { getRetryNetwork, RETRY_NETWORKS } from '../../config/chains.js'
import { RetryWeb3Error, toRetryWeb3Error } from '../../lib/errors.js'
import { formatEth, formatEthExact } from '../../lib/format.js'
import { useRetryWeb3Settings } from '../context.js'

export type RetryBalanceStatus = 'disconnected' | 'wrong-network' | 'loading' | 'success' | 'error'

export interface RetryBalanceState {
  status: RetryBalanceStatus
  /** Balance in wei. Only set when the latest read succeeded. */
  value: bigint | undefined
  /** Display string truncated to 4 decimals, e.g. `0.0234`. */
  formatted: string | undefined
  /** Full precision decimal string, e.g. `0.023456789012345678`. */
  exact: string | undefined
  /** `0.0234 ETH` */
  display: string | undefined
  symbol: string
  /** Chain the balance was read from (the wallet's active chain). */
  chainId: number | undefined
  error: RetryWeb3Error | undefined
  isLoading: boolean
  isFetching: boolean
  /** Unix ms of the last successful read. */
  updatedAt: number | undefined
  /** Manual refresh. No-op while disconnected or on an unsupported network. */
  refetch: () => void
}

export interface UseRetryBalanceOptions {
  /** Override the polling interval from the config. `false` disables polling. */
  refetchIntervalMs?: number | false
  /** Fraction digits in `formatted`. Default 4. */
  maximumFractionDigits?: number
}

/**
 * Native ETH balance of the connected account on the wallet's active Base
 * network, read through the app's RPC transports (read-only, no signature).
 *
 * The query key contains address and chain, so an account or network change
 * starts a fresh read and a previous account's balance is never shown. On
 * failure the value is cleared; there is no fallback number.
 */
export function useRetryBalance(options: UseRetryBalanceOptions = {}): RetryBalanceState {
  const settings = useRetryWeb3Settings()
  const connection = useConnection()
  const address = connection.isConnected ? connection.address : undefined
  const network = getRetryNetwork(connection.isConnected ? connection.chainId : undefined)
  const enabled = Boolean(address && network)

  const query = useBalance({
    address,
    chainId: network?.id,
    query: {
      enabled,
      refetchInterval: options.refetchIntervalMs ?? settings.balanceRefreshIntervalMs,
      refetchIntervalInBackground: false,
    },
  })

  const { refetch: refetchQuery } = query
  const refetch = useCallback(() => {
    if (enabled) void refetchQuery()
  }, [enabled, refetchQuery])

  const maximumFractionDigits = options.maximumFractionDigits ?? 4
  const symbol = network?.nativeSymbol ?? 'ETH'

  return useMemo<RetryBalanceState>(() => {
    const base = {
      symbol,
      chainId: network?.id,
      isFetching: query.isFetching,
      refetch,
    }
    if (!address) {
      return {
        ...base,
        status: 'disconnected',
        value: undefined,
        formatted: undefined,
        exact: undefined,
        display: undefined,
        error: undefined,
        isLoading: false,
        updatedAt: undefined,
      }
    }
    if (!network) {
      return {
        ...base,
        status: 'wrong-network',
        value: undefined,
        formatted: undefined,
        exact: undefined,
        display: undefined,
        error: new RetryWeb3Error('WRONG_NETWORK', {
          message: `Please switch to ${RETRY_NETWORKS[settings.targetChainId].name}.`,
        }),
        isLoading: false,
        updatedAt: undefined,
      }
    }
    if (query.status === 'error') {
      return {
        ...base,
        status: 'error',
        value: undefined,
        formatted: undefined,
        exact: undefined,
        display: undefined,
        error: toRetryWeb3Error(query.error, { context: 'balance' }),
        isLoading: false,
        updatedAt: undefined,
      }
    }
    if (query.status === 'success') {
      const value = query.data.value
      const formatted = formatEth(value, { maximumFractionDigits })
      return {
        ...base,
        status: 'success',
        value,
        formatted,
        exact: formatEthExact(value),
        display: `${formatted} ${symbol}`,
        error: undefined,
        isLoading: false,
        updatedAt: query.dataUpdatedAt,
      }
    }
    return {
      ...base,
      status: 'loading',
      value: undefined,
      formatted: undefined,
      exact: undefined,
      display: undefined,
      error: undefined,
      isLoading: true,
      updatedAt: undefined,
    }
  }, [
    address,
    network,
    symbol,
    query.status,
    query.data,
    query.error,
    query.dataUpdatedAt,
    query.isFetching,
    refetch,
    maximumFractionDigits,
    settings.targetChainId,
  ])
}
