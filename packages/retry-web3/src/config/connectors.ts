import { type CreateConnectorFn, injected } from 'wagmi'
import { coinbaseWallet } from 'wagmi/connectors/coinbaseWallet'
import { metaMask } from 'wagmi/connectors/metaMask'
import { walletConnect } from 'wagmi/connectors/walletConnect'

export interface RetryAppMetadata {
  /** Shown inside wallets on connection prompts. */
  name: string
  description?: string | undefined
  /** Canonical https URL of the app. Defaults to the current origin in the browser. */
  url?: string | undefined
  /** Absolute https URL of a square icon. */
  iconUrl?: string | undefined
}

export const DEFAULT_RETRY_APP_METADATA: RetryAppMetadata = {
  name: 'RETRY',
  description: 'RETRY memecoin launchpad on Base',
}

/** Stable connector IDs as created by wagmi. */
export const RETRY_CONNECTOR_IDS = {
  injected: 'injected',
  metaMask: 'metaMaskSDK',
  coinbaseWallet: 'coinbaseWalletSDK',
  walletConnect: 'walletConnect',
} as const

export interface RetryConnectorsOptions {
  app: RetryAppMetadata
  /** WalletConnect is only registered when a valid project ID is provided. */
  walletConnectProjectId?: string | undefined
}

function resolveAppUrl(app: RetryAppMetadata): string | undefined {
  if (app.url) return app.url
  if (typeof window !== 'undefined') return window.location.origin
  return undefined
}

/**
 * Wallet connectors, in display order:
 *
 * 1. EIP-6963 browser wallets are discovered automatically by wagmi
 *    (`multiInjectedProviderDiscovery`) and de-duplicated by RDNS against the
 *    connectors below, so MetaMask or Coinbase Wallet extensions never show twice.
 * 2. `injected()` covers legacy EIP-1193 wallets that only expose `window.ethereum`
 *    (common in mobile in-app browsers). The UI hides it when EIP-6963 wallets exist.
 * 3. MetaMask: extension when installed, otherwise MetaMask Mobile via QR / deep link.
 * 4. Coinbase Wallet: extension when installed, otherwise the Coinbase popup / mobile app.
 * 5. WalletConnect: QR code pairing, only when a project ID is configured.
 *
 * SDKs for 3–5 are loaded lazily by wagmi the first time the user picks them.
 */
export function createRetryConnectors(options: RetryConnectorsOptions): CreateConnectorFn[] {
  const { app, walletConnectProjectId } = options
  const url = resolveAppUrl(app)

  const connectors: CreateConnectorFn[] = [
    injected({ shimDisconnect: true }),
    metaMask({
      dapp: {
        name: app.name,
        ...(url ? { url } : {}),
        ...(app.iconUrl ? { iconUrl: app.iconUrl } : {}),
      },
    }),
    coinbaseWallet({
      appName: app.name,
      appLogoUrl: app.iconUrl ?? null,
      preference: { options: 'all' },
    }),
  ]

  if (walletConnectProjectId) {
    connectors.push(
      walletConnect({
        projectId: walletConnectProjectId,
        showQrModal: true,
        metadata: {
          name: app.name,
          description: app.description ?? app.name,
          url: url ?? 'https://localhost',
          icons: app.iconUrl ? [app.iconUrl] : [],
        },
      }),
    )
  }

  return connectors
}
