'use client'

import type { RetryWalletKind } from '../hooks/useRetryWalletOptions.js'

export interface WalletIconProps {
  kind: RetryWalletKind
  /** Icon announced by the wallet itself (EIP-6963 data URI). Preferred when present. */
  src?: string | undefined
  name: string
  size?: number
  className?: string | undefined
}

function isRenderableIcon(src: string | undefined): src is string {
  return Boolean(src && (/^data:image\//i.test(src) || /^https:\/\//i.test(src)))
}

/**
 * Wallet logo. Uses the wallet's own announced icon when available, otherwise
 * a simplified built-in mark. Icons are rendered through <img>, never as HTML.
 */
export function WalletIcon({ kind, src, name, size = 32, className }: WalletIconProps) {
  const classes = ['rw3-wallet-icon', className].filter(Boolean).join(' ')
  if (isRenderableIcon(src)) {
    return <img className={classes} src={src} alt="" width={size} height={size} draggable={false} />
  }
  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      data-wallet={name}
    >
      {kind === 'metaMask' ? (
        <>
          <rect width="32" height="32" rx="8" fill="#FFF5EB" />
          <path d="M25.6 6.4 17.6 12.3l1.5-3.5 6.5-2.4Z" fill="#E2761B" />
          <path d="m6.4 6.4 7.9 6-1.4-3.6-6.5-2.4Z" fill="#E4761B" />
          <path
            d="m22.7 20.6-2.1 3.3 4.5 1.2 1.3-4.4-3.7-.1Zm-17.1.1 1.3 4.4 4.5-1.2-2.1-3.3-3.7.1Z"
            fill="#E4761B"
          />
          <path
            d="m11.2 15.1-1.3 1.9 4.5.2-.2-4.8-3 2.7Zm9.6 0-3.1-2.8-.1 4.9 4.5-.2-1.3-1.9Zm-9.4 8.8 2.7-1.3-2.3-1.8-.4 3.1Zm6.5-1.3 2.7 1.3-.4-3.1-2.3 1.8Z"
            fill="#E4761B"
          />
          <path d="m13.5 18.3-3.7-1.1 2.6-1.2 1.1 2.3Zm5 0 1.1-2.3 2.6 1.2-3.7 1.1Z" fill="#233447" />
          <path d="m11.4 23.9.4-3.3-2.5.1 2.1 3.2Zm8.8-3.3.4 3.3 2.1-3.2-2.5-.1Z" fill="#CD6116" />
        </>
      ) : kind === 'coinbaseWallet' ? (
        <>
          <rect width="32" height="32" rx="8" fill="#0052FF" />
          <circle cx="16" cy="16" r="9" fill="#FFFFFF" />
          <rect x="13" y="13" width="6" height="6" rx="1.2" fill="#0052FF" />
        </>
      ) : kind === 'walletConnect' ? (
        <>
          <rect width="32" height="32" rx="8" fill="#3B99FC" />
          <path
            d="M10.1 12.6c3.3-3.2 8.5-3.2 11.8 0l.4.4c.2.2.2.4 0 .6l-1.4 1.3c-.1.1-.2.1-.3 0l-.5-.5c-2.3-2.2-6-2.2-8.2 0l-.6.5c-.1.1-.2.1-.3 0l-1.4-1.3c-.2-.2-.2-.4 0-.6l.5-.4Zm14.6 2.7 1.2 1.2c.2.2.2.4 0 .6l-5.5 5.4c-.2.2-.4.2-.6 0l-3.9-3.8h-.1l-3.9 3.8c-.2.2-.4.2-.6 0l-5.5-5.4c-.2-.2-.2-.4 0-.6l1.2-1.2c.2-.2.4-.2.6 0l3.9 3.8h.1l3.9-3.8c.2-.2.4-.2.6 0l3.9 3.8h.1l3.9-3.8c.1-.2.4-.2.6 0Z"
            fill="#FFFFFF"
          />
        </>
      ) : (
        <>
          <rect width="32" height="32" rx="8" fill="currentColor" opacity="0.12" />
          <path
            d="M9 11.5A2.5 2.5 0 0 1 11.5 9h9a1.5 1.5 0 0 1 1.5 1.5V12h.5a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A2.5 2.5 0 0 1 9 20.5v-9Zm2.5-.5a.5.5 0 0 0 0 1H20v-1h-8.5Zm8 5.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"
            fill="currentColor"
          />
        </>
      )}
    </svg>
  )
}
