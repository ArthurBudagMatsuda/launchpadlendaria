'use client'

import { type UseRetryBalanceOptions, useRetryBalance } from '../hooks/useRetryBalance.js'
import { cx, Spinner } from './internal.js'

export interface EthBalanceProps extends UseRetryBalanceOptions {
  /** Text before the amount. Default `Balance:`. */
  label?: string
  showRefresh?: boolean
  className?: string | undefined
}

/**
 * `Balance: 0.0234 ETH` for the connected wallet, with explicit loading,
 * wrong-network and error states. Never shows a placeholder number.
 */
export function EthBalance({
  label = 'Balance:',
  showRefresh = true,
  className,
  ...options
}: EthBalanceProps) {
  const balance = useRetryBalance(options)

  return (
    <div className={cx('rw3-balance', `rw3-balance--${balance.status}`, className)} data-testid="rw3-balance">
      {balance.status === 'success' ? (
        <span
          className="rw3-balance-value"
          title={balance.exact ? `${balance.exact} ${balance.symbol}` : undefined}
        >
          {label} {balance.display}
        </span>
      ) : balance.status === 'loading' ? (
        <span className="rw3-balance-value">
          {label} <Spinner label="Loading balance" />
        </span>
      ) : balance.status === 'disconnected' ? (
        <span className="rw3-balance-value rw3-muted">{label} —</span>
      ) : (
        <span className="rw3-balance-error" role="alert">
          <span>{balance.error?.message}</span>
          {balance.error?.hint ? <span className="rw3-muted"> {balance.error.hint}</span> : null}
        </span>
      )}
      {showRefresh && (balance.status === 'success' || balance.status === 'error') ? (
        <button
          type="button"
          className="rw3-icon-button rw3-refresh"
          onClick={balance.refetch}
          disabled={balance.isFetching}
          aria-label="Refresh balance"
          title="Refresh balance"
        >
          {balance.isFetching ? <Spinner /> : '↻'}
        </button>
      ) : null}
    </div>
  )
}
