'use client'

import { useEffect, useId, useRef } from 'react'
import { useConnection } from 'wagmi'
import { hasLegacyInjectedProvider, isMobileBrowser } from '../eip6963.js'
import type { RetryWalletActions } from '../hooks/useRetryWalletActions.js'
import { type RetryWalletOption, useRetryWalletOptions } from '../hooks/useRetryWalletOptions.js'
import { cx, Portal, Spinner, useFocusTrap } from './internal.js'
import { WalletIcon } from './WalletIcon.js'

export interface ConnectWalletModalProps {
  open: boolean
  onClose: () => void
  /** Shared actions from the opener, so its button can reflect pending/error state. */
  actions: RetryWalletActions
  className?: string | undefined
  title?: string
}

function statusLabel(option: RetryWalletOption, pending: boolean): string {
  if (pending) return 'Waiting for wallet…'
  if (option.isConnected) return 'Connected'
  return option.detail
}

/**
 * Wallet picker. Lists every available connector with its icon and state,
 * shows friendly errors, and closes itself once the connector confirms the
 * connection.
 */
export function ConnectWalletModal({
  open,
  onClose,
  actions,
  className,
  title = 'Connect Wallet',
}: ConnectWalletModalProps) {
  const options = useRetryWalletOptions()
  const connection = useConnection()
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const pendingUid = actions.pendingConnectorUid
  const waitingOnExternalUi = Boolean(pendingUid)

  // Release the focus trap while a wallet SDK shows its own popup or QR modal.
  useFocusTrap(open && !waitingOnExternalUi, dialogRef)

  const { reset } = actions
  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  // Close only after wagmi reports that the connector confirmed the connection.
  useEffect(() => {
    if (open && connection.status === 'connected') onClose()
  }, [open, connection.status, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const first = dialogRef.current?.querySelector<HTMLButtonElement>('button.rw3-option:not([disabled])')
    first?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const noBrowserWallet =
    !isMobileBrowser() &&
    !hasLegacyInjectedProvider() &&
    !options.some((option) => option.availability === 'installed')

  return (
    <Portal>
      <div className="rw3-root rw3-overlay" data-testid="rw3-connect-modal">
        <button
          type="button"
          className="rw3-overlay-dismiss"
          aria-label="Close wallet selection"
          tabIndex={-1}
          onClick={onClose}
        />
        <div
          ref={dialogRef}
          className={cx('rw3-modal', className)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="rw3-modal-header">
            <h2 id={titleId} className="rw3-modal-title">
              {title}
            </h2>
            <button type="button" className="rw3-icon-button" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </div>

          <ul className="rw3-option-list">
            {options.map((option) => {
              const pending = pendingUid !== undefined && option.connector?.uid === pendingUid
              const connector = option.connector
              return (
                <li key={option.key}>
                  <button
                    type="button"
                    className={cx(
                      'rw3-option',
                      option.isConnected && 'rw3-option--connected',
                      option.disabled && 'rw3-option--disabled',
                    )}
                    disabled={option.disabled || waitingOnExternalUi}
                    aria-busy={pending || undefined}
                    data-wallet-kind={option.kind}
                    onClick={() => {
                      if (connector) actions.connect(connector)
                    }}
                  >
                    <WalletIcon kind={option.kind} src={option.icon} name={option.name} />
                    <span className="rw3-option-text">
                      <span className="rw3-option-name">{option.name}</span>
                      <span className="rw3-option-detail">{statusLabel(option, pending)}</span>
                    </span>
                    {pending ? (
                      <Spinner label={`Connecting to ${option.name}`} />
                    ) : (
                      <span className={cx('rw3-badge', `rw3-badge--${option.availability}`)}>
                        {option.isConnected
                          ? 'Connected'
                          : option.availability === 'installed'
                            ? 'Detected'
                            : option.availability === 'not-configured'
                              ? 'Unavailable'
                              : option.kind === 'walletConnect'
                                ? 'QR'
                                : 'Available'}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>

          {actions.connectError ? (
            <p className="rw3-message rw3-message--error" role="alert">
              {actions.connectError.message}
            </p>
          ) : null}

          {waitingOnExternalUi ? (
            <div className="rw3-message rw3-message--info">
              <span>Confirm the connection in your wallet.</span>
              <button type="button" className="rw3-link-button" onClick={actions.reset}>
                Cancel
              </button>
            </div>
          ) : null}

          {noBrowserWallet ? (
            <p className="rw3-message rw3-message--muted">
              No browser wallet detected. Install{' '}
              <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">
                MetaMask
              </a>{' '}
              or connect a mobile wallet.
            </p>
          ) : null}

          <p className="rw3-footnote">
            RETRY never asks for your seed phrase or private key. Connecting only shares your public address.
          </p>
        </div>
      </div>
    </Portal>
  )
}
