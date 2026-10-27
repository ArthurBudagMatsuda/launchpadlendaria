'use client'

import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import { useConnection } from 'wagmi'
import { shortenAddress } from '../../lib/address.js'
import { useRetryNetwork } from '../hooks/useRetryNetwork.js'
import { useRetryWalletActions } from '../hooks/useRetryWalletActions.js'
import { ConnectWalletModal } from './ConnectWalletModal.js'
import { cx, Portal, Spinner, useDismiss, useMediaQuery } from './internal.js'
import { WalletMenu } from './WalletMenu.js'

const COMPACT_QUERY = '(max-width: 480px)'

export interface ConnectWalletButtonProps {
  /** Label while disconnected. Default `Connect Wallet`. */
  label?: string
  className?: string | undefined
  /** Extra class for the modal / menu panels. */
  panelClassName?: string | undefined
  /** Menu alignment relative to the button. Default `end` (right aligned, for headers). */
  align?: 'start' | 'end'
}

/**
 * The RETRY wallet button.
 * - Disconnected: `Connect Wallet`, opens the wallet picker.
 * - Connected: abbreviated address (`0x84A2...3F91`), opens the account menu.
 * - Unsupported chain: `Wrong Network`, opens the menu with the switch action.
 */
export function ConnectWalletButton({
  label = 'Connect Wallet',
  className,
  panelClassName,
  align = 'end',
}: ConnectWalletButtonProps) {
  const connection = useConnection()
  const network = useRetryNetwork()
  const actions = useRetryWalletActions()
  const [modalOpen, setModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  // On phones the menu is a bottom sheet rendered into <body>, so a header
  // with `backdrop-filter` or `transform` cannot trap the fixed panel.
  const compact = useMediaQuery(COMPACT_QUERY)

  const closeModal = useCallback(() => setModalOpen(false), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const dismissRefs = useMemo(() => [anchorRef, sheetRef], [])
  useDismiss(menuOpen, dismissRefs, closeMenu)

  const address = connection.address
  const showAccount = Boolean(address) && (connection.isConnected || connection.isReconnecting)

  let content: ReactNode = label
  let variant = 'primary'
  if (showAccount && address) {
    if (network.isWrongNetwork) {
      content = (
        <>
          <span className="rw3-dot rw3-dot--error" aria-hidden="true" />
          Wrong Network
        </>
      )
      variant = 'danger'
    } else {
      content = (
        <>
          <span className={cx('rw3-dot', `rw3-dot--${network.scenario}`)} aria-hidden="true" />
          <span className="rw3-mono">{shortenAddress(address)}</span>
        </>
      )
      variant = 'account'
    }
  } else if (actions.connectStatus === 'pending') {
    // Only a connection the user started here. wagmi also reports `connecting`
    // while silently probing for a previous session on page load.
    content = (
      <>
        <Spinner /> Connecting…
      </>
    )
  }

  return (
    <span ref={anchorRef} className={cx('rw3-root', 'rw3-anchor', `rw3-anchor--${align}`)}>
      <button
        type="button"
        className={cx('rw3-button', `rw3-button--${variant}`, className)}
        aria-haspopup="dialog"
        aria-expanded={showAccount ? menuOpen : modalOpen}
        data-testid="rw3-connect-button"
        onClick={() => (showAccount ? setMenuOpen((open) => !open) : setModalOpen(true))}
      >
        {content}
      </button>
      {showAccount && menuOpen ? (
        compact ? (
          <Portal>
            <div className="rw3-root rw3-sheet-backdrop" aria-hidden="true" />
            <div ref={sheetRef}>
              <WalletMenu
                actions={actions}
                onClose={closeMenu}
                className={cx('rw3-menu--sheet', panelClassName)}
              />
            </div>
          </Portal>
        ) : (
          <WalletMenu actions={actions} onClose={closeMenu} className={panelClassName} />
        )
      ) : null}
      <ConnectWalletModal
        open={modalOpen && !showAccount}
        onClose={closeModal}
        actions={actions}
        className={panelClassName}
      />
    </span>
  )
}
