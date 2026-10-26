'use client'

import { useMemo } from 'react'
import { type Connector, useConnection, useConnectors } from 'wagmi'
import { RETRY_CONNECTOR_IDS } from '../../config/connectors.js'
import { RETRY_WEB3_ERROR_MESSAGES } from '../../lib/errors.js'
import { useRetryWeb3Settings } from '../context.js'
import { hasLegacyInjectedProvider, isMobileBrowser, useEip6963Wallets } from '../eip6963.js'

export type RetryWalletKind =
  | 'browser'
  | 'injected'
  | 'metaMask'
  | 'coinbaseWallet'
  | 'walletConnect'
  | 'other'

/**
 * - `installed`: a browser extension / in-app wallet was detected.
 * - `available`: connectable through the wallet's SDK (popup, QR code or deep link).
 * - `not-configured`: needs app configuration (WalletConnect without project ID).
 */
export type RetryWalletAvailability = 'installed' | 'available' | 'not-configured'

export interface RetryWalletOption {
  /** Stable key for lists. */
  key: string
  name: string
  kind: RetryWalletKind
  /** Icon announced by the wallet (EIP-6963), if any. */
  icon: string | undefined
  availability: RetryWalletAvailability
  /** Short status line, e.g. "Installed" or "Scan QR code". */
  detail: string
  disabled: boolean
  isConnected: boolean
  /** `undefined` only for options that cannot be used (not configured). */
  connector: Connector | undefined
}

const METAMASK_RDNS = ['io.metamask', 'io.metamask.mobile', 'io.metamask.flask']
const COINBASE_RDNS = ['com.coinbase.wallet']

function kindOf(connector: Connector): RetryWalletKind {
  switch (connector.id) {
    case RETRY_CONNECTOR_IDS.injected:
      return 'injected'
    case RETRY_CONNECTOR_IDS.metaMask:
      return 'metaMask'
    case RETRY_CONNECTOR_IDS.coinbaseWallet:
      return 'coinbaseWallet'
    case RETRY_CONNECTOR_IDS.walletConnect:
      return 'walletConnect'
    default:
      return connector.type === 'injected' ? 'browser' : 'other'
  }
}

const ORDER: Record<RetryWalletKind, number> = {
  browser: 1,
  metaMask: 2,
  coinbaseWallet: 3,
  walletConnect: 4,
  injected: 5,
  other: 6,
}

/**
 * Wallet choices for a connect modal, built from wagmi's connectors.
 * Browser wallets discovered through EIP-6963 come first; the generic
 * "Browser Wallet" entry only appears for legacy wallets that do not announce
 * themselves, so a wallet is never listed twice.
 */
export function useRetryWalletOptions(): RetryWalletOption[] {
  const connectors = useConnectors()
  const connection = useConnection()
  const settings = useRetryWeb3Settings()
  const announced = useEip6963Wallets()

  return useMemo(() => {
    const announcedRdns = new Set(announced.map((wallet) => wallet.rdns))
    const legacy = hasLegacyInjectedProvider()
    const mobile = isMobileBrowser()
    const hasBrowserWallets = connectors.some((c) => kindOf(c) === 'browser') || announced.length > 0
    const connectedUid = connection.isConnected ? connection.connector?.uid : undefined

    const options: RetryWalletOption[] = []
    for (const connector of connectors) {
      const kind = kindOf(connector)
      const base = {
        key: connector.uid,
        name: connector.name,
        kind,
        icon: connector.icon,
        disabled: false,
        isConnected: connector.uid === connectedUid,
        connector,
      }

      if (kind === 'injected') {
        // Only for wallets that expose window.ethereum without EIP-6963.
        if (!legacy || hasBrowserWallets) continue
        options.push({ ...base, name: 'Browser Wallet', availability: 'installed', detail: 'Detected' })
        continue
      }
      if (kind === 'metaMask') {
        const installed = METAMASK_RDNS.some((rdns) => announcedRdns.has(rdns))
        const icon = announced.find((wallet) => METAMASK_RDNS.includes(wallet.rdns))?.icon
        options.push({
          ...base,
          icon: icon ?? base.icon,
          availability: installed ? 'installed' : 'available',
          detail: installed ? 'Installed' : mobile ? 'Open MetaMask app' : 'Scan with MetaMask Mobile',
        })
        continue
      }
      if (kind === 'coinbaseWallet') {
        const installed = COINBASE_RDNS.some((rdns) => announcedRdns.has(rdns))
        const icon = announced.find((wallet) => COINBASE_RDNS.includes(wallet.rdns))?.icon
        options.push({
          ...base,
          icon: icon ?? base.icon,
          availability: installed ? 'installed' : 'available',
          detail: installed ? 'Installed' : mobile ? 'Open Coinbase Wallet app' : 'Popup or mobile app',
        })
        continue
      }
      if (kind === 'walletConnect') {
        options.push({ ...base, availability: 'available', detail: 'Scan QR code with a mobile wallet' })
        continue
      }
      options.push({ ...base, availability: 'installed', detail: 'Detected' })
    }

    if (!settings.walletConnectEnabled) {
      options.push({
        key: 'walletConnect:not-configured',
        name: 'WalletConnect',
        kind: 'walletConnect',
        icon: undefined,
        availability: 'not-configured',
        detail: RETRY_WEB3_ERROR_MESSAGES.WALLETCONNECT_NOT_CONFIGURED,
        disabled: true,
        isConnected: false,
        connector: undefined,
      })
    }

    return options.sort((a, b) => {
      if (a.availability === 'installed' && b.availability !== 'installed') return -1
      if (b.availability === 'installed' && a.availability !== 'installed') return 1
      return ORDER[a.kind] - ORDER[b.kind]
    })
  }, [
    connectors,
    connection.isConnected,
    connection.connector?.uid,
    settings.walletConnectEnabled,
    announced,
  ])
}
