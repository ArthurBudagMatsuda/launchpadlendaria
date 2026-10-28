'use client'

import type { ReactNode } from 'react'
import { type RetryNetworkState, useRetryNetwork } from '../hooks/useRetryNetwork.js'
import { ConnectWalletButton } from './ConnectWalletButton.js'
import { cx, Spinner } from './internal.js'

export interface SwitchNetworkButtonProps {
  network?: RetryNetworkState
  className?: string | undefined
  variant?: 'primary' | 'secondary'
}

/** `Switch to Base Sepolia` (development) / `Switch to Base` (production). User-initiated only. */
export function SwitchNetworkButton({
  network: provided,
  className,
  variant = 'primary',
}: SwitchNetworkButtonProps) {
  const own = useRetryNetwork()
  const network = provided ?? own
  if (!network.canSwitch) {
    return (
      <p className="rw3-message rw3-message--muted">
        Switch to {network.targetNetwork.name} in your wallet to continue.
      </p>
    )
  }
  return (
    <button
      type="button"
      className={cx('rw3-button', `rw3-button--${variant}`, className)}
      onClick={network.switchToTarget}
      disabled={network.isSwitching}
    >
      {network.isSwitching ? (
        <>
          <Spinner /> Check your wallet…
        </>
      ) : (
        network.switchLabel
      )}
    </button>
  )
}

export interface WrongNetworkNoticeProps {
  className?: string | undefined
}

/** `Wrong Network` + explanation + switch button. Renders nothing on a supported network. */
export function WrongNetworkNotice({ className }: WrongNetworkNoticeProps) {
  const network = useRetryNetwork()
  if (!network.isWrongNetwork) return null
  return (
    <div className={cx('rw3-root', 'rw3-notice', 'rw3-notice--error', className)} role="alert">
      <strong className="rw3-notice-title">Wrong Network</strong>
      <span>{network.notice?.message}</span>
      <SwitchNetworkButton network={network} />
      {network.switchError ? (
        <span className="rw3-message rw3-message--error">{network.switchError.message}</span>
      ) : null}
    </div>
  )
}

export interface NetworkGuardProps {
  children: ReactNode
  /**
   * `true`: only the target network passes (Base Sepolia in development).
   * `false` (default): any supported Base network passes.
   */
  requireTarget?: boolean
  /** Replaces the built-in disconnected / wrong-network UI. */
  fallback?: ReactNode | ((network: RetryNetworkState) => ReactNode)
  className?: string | undefined
}

/**
 * Renders `children` only when a wallet is connected to a supported Base
 * network. Use it around the Trade panel and Create Token form; the buy/sell
 * buttons inside must still stay disabled while
 * `financialOperationsEnabled` is false.
 */
export function NetworkGuard({ children, requireTarget = false, fallback, className }: NetworkGuardProps) {
  const network = useRetryNetwork()
  const passes = requireTarget ? network.isOnTarget : network.isSupported
  if (passes) return <>{children}</>

  if (fallback !== undefined) return <>{typeof fallback === 'function' ? fallback(network) : fallback}</>

  if (network.scenario === 'disconnected') {
    return (
      <div className={cx('rw3-root', 'rw3-notice', className)}>
        <strong className="rw3-notice-title">Connect your wallet</strong>
        <span>Connect a wallet on {network.targetNetwork.name} to continue.</span>
        <ConnectWalletButton />
      </div>
    )
  }

  const tone = network.isWrongNetwork ? 'error' : 'warning'
  return (
    <div className={cx('rw3-root', 'rw3-notice', `rw3-notice--${tone}`, className)} role="alert">
      <strong className="rw3-notice-title">
        {network.isWrongNetwork ? 'Wrong Network' : `Please switch to ${network.targetNetwork.name}`}
      </strong>
      <span>{network.notice?.message}</span>
      <SwitchNetworkButton network={network} />
      {network.switchError ? (
        <span className="rw3-message rw3-message--error">{network.switchError.message}</span>
      ) : null}
    </div>
  )
}
