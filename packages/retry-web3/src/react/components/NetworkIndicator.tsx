'use client'

import { useRetryNetwork } from '../hooks/useRetryNetwork.js'
import { cx } from './internal.js'

export interface NetworkIndicatorProps {
  /** What to show without a wallet: the target network (muted) or nothing. Default `target`. */
  whenDisconnected?: 'target' | 'hidden'
  className?: string | undefined
}

/**
 * Live network pill for the header: the network the wallet is actually on,
 * or `Wrong Network`. Replaces static network labels.
 */
export function NetworkIndicator({ whenDisconnected = 'target', className }: NetworkIndicatorProps) {
  const network = useRetryNetwork()
  if (network.scenario === 'disconnected' && whenDisconnected === 'hidden') return null

  const label =
    network.scenario === 'wrong-network'
      ? 'Wrong Network'
      : network.scenario === 'disconnected'
        ? network.targetNetwork.name
        : (network.walletNetwork?.name ?? network.targetNetwork.name)

  const title =
    network.scenario === 'disconnected'
      ? `Not connected. RETRY uses ${network.targetNetwork.name}.`
      : (network.notice?.message ?? label)

  return (
    <span
      className={cx('rw3-root', 'rw3-network', `rw3-network--${network.scenario}`, className)}
      title={title}
      data-testid="rw3-network-indicator"
      data-chain-id={network.walletChainId}
    >
      <span className="rw3-dot" aria-hidden="true" />
      <span>{label}</span>
      {network.walletNetwork?.isTestnet && network.scenario !== 'wrong-network' ? (
        <span className="rw3-tag">Testnet</span>
      ) : null}
    </span>
  )
}
