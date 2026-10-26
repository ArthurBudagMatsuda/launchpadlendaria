'use client'

import { useEffect, useId, useState } from 'react'
import { useConnection } from 'wagmi'
import { getExplorerAddressUrl } from '../../lib/explorer.js'
import { useRetryNetwork } from '../hooks/useRetryNetwork.js'
import type { RetryWalletActions } from '../hooks/useRetryWalletActions.js'
import { EthBalance } from './EthBalance.js'
import { copyText, cx, Spinner } from './internal.js'
import { SwitchNetworkButton } from './NetworkGuard.js'

export interface WalletMenuProps {
  actions: RetryWalletActions
  onClose: () => void
  className?: string | undefined
}

/**
 * Account panel opened from the connected button: full address with copy,
 * active network, live ETH balance, explorer link, network switch and
 * disconnect. Every value comes from the connected wallet and the chain.
 */
export function WalletMenu({ actions, onClose, className }: WalletMenuProps) {
  const connection = useConnection()
  const network = useRetryNetwork()
  const titleId = useId()
  const [copied, setCopied] = useState<{ address: string; state: 'copied' | 'failed' } | undefined>()

  const address = connection.isConnected ? connection.address : undefined
  const connectorName = connection.isConnected ? connection.connector?.name : undefined
  // Tied to the address it was made for, so it never survives an account switch.
  const copyState = copied && copied.address === address ? copied.state : 'idle'

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(undefined), 2_000)
    return () => clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    if (!connection.isConnected && !connection.isReconnecting) onClose()
  }, [connection.isConnected, connection.isReconnecting, onClose])

  if (!address) return null

  const explorerUrl = getExplorerAddressUrl(network.walletChainId, address)

  return (
    <div
      className={cx('rw3-root', 'rw3-menu', className)}
      role="dialog"
      aria-labelledby={titleId}
      data-testid="rw3-wallet-menu"
    >
      <div className="rw3-menu-section">
        <span id={titleId} className="rw3-label">
          {connectorName ? `Connected with ${connectorName}` : 'Connected wallet'}
        </span>
        <code className="rw3-address" data-testid="rw3-full-address">
          {address}
        </code>
        <button
          type="button"
          className="rw3-button rw3-button--secondary rw3-button--small"
          onClick={async () => setCopied({ address, state: (await copyText(address)) ? 'copied' : 'failed' })}
        >
          {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy Address'}
        </button>
      </div>

      <div className="rw3-menu-section">
        <span className="rw3-label">Network</span>
        <span
          className={cx('rw3-network', `rw3-network--${network.scenario}`)}
          data-testid="rw3-menu-network"
        >
          <span className="rw3-dot" aria-hidden="true" />
          {network.isWrongNetwork ? 'Wrong Network' : network.walletNetwork?.name}
          {network.isWrongNetwork && network.walletNetworkName ? (
            <span className="rw3-muted"> ({network.walletNetworkName})</span>
          ) : null}
        </span>
        {network.notice && network.scenario !== 'target' ? (
          <span className={cx('rw3-message', `rw3-message--${network.notice.tone}`)}>
            {network.notice.message}
          </span>
        ) : null}
        {network.isWrongNetwork ? <SwitchNetworkButton network={network} /> : null}
        {network.scenario === 'supported' ? (
          <SwitchNetworkButton network={network} variant="secondary" />
        ) : null}
        {network.switchError ? (
          <span className="rw3-message rw3-message--error" role="alert">
            {network.switchError.message}
          </span>
        ) : null}
      </div>

      {network.isWrongNetwork ? null : (
        // On an unsupported chain the network notice above already explains why there is no balance.
        <div className="rw3-menu-section">
          <EthBalance />
        </div>
      )}

      <div className="rw3-menu-section rw3-menu-actions">
        {explorerUrl ? (
          <a className="rw3-link" href={explorerUrl} target="_blank" rel="noopener noreferrer">
            View on {network.walletNetwork?.explorerName ?? 'explorer'} ↗
          </a>
        ) : null}
        <button
          type="button"
          className="rw3-button rw3-button--danger"
          onClick={actions.disconnect}
          disabled={actions.disconnectStatus === 'pending'}
        >
          {actions.disconnectStatus === 'pending' ? <Spinner /> : null}
          Disconnect
        </button>
        {actions.disconnectError ? (
          <span className="rw3-message rw3-message--error" role="alert">
            {actions.disconnectError.message}
          </span>
        ) : null}
      </div>
    </div>
  )
}
