'use client'

import { useSyncExternalStore } from 'react'

/**
 * Read-only view of wallets announced through EIP-6963. wagmi turns these
 * into connectors on its own; this store only answers "is MetaMask / Coinbase
 * Wallet installed?" for the wallet picker without touching any provider.
 */
export interface Eip6963WalletInfo {
  uuid: string
  name: string
  /** data: URI supplied by the wallet. Render with <img>, never as HTML. */
  icon: string | undefined
  rdns: string
}

const EMPTY: readonly Eip6963WalletInfo[] = Object.freeze([])
let snapshot: readonly Eip6963WalletInfo[] = EMPTY
const wallets = new Map<string, Eip6963WalletInfo>()
const listeners = new Set<() => void>()
let started = false

function isSafeIcon(icon: unknown): icon is string {
  return typeof icon === 'string' && /^data:image\/(svg\+xml|png|jpeg|webp|gif)[;,]/i.test(icon)
}

function onAnnounce(event: Event) {
  const detail = (event as CustomEvent<{ info?: Record<string, unknown> }>).detail
  const info = detail?.info
  if (!info || typeof info.uuid !== 'string' || typeof info.rdns !== 'string') return
  const name = typeof info.name === 'string' && info.name.trim() ? info.name.trim() : info.rdns
  wallets.set(info.uuid, {
    uuid: info.uuid,
    name,
    icon: isSafeIcon(info.icon) ? info.icon : undefined,
    rdns: info.rdns,
  })
  snapshot = Object.freeze([...wallets.values()])
  for (const listener of listeners) listener()
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('eip6963:announceProvider', onAnnounce)
  window.dispatchEvent(new Event('eip6963:requestProvider'))
}

function subscribe(listener: () => void) {
  start()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useEip6963Wallets(): readonly Eip6963WalletInfo[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  )
}

/** Test helper: forget announced wallets. */
export function resetEip6963Store(): void {
  wallets.clear()
  snapshot = EMPTY
  if (typeof window !== 'undefined') window.removeEventListener('eip6963:announceProvider', onAnnounce)
  started = false
}

/** Legacy `window.ethereum` detection for wallets that do not implement EIP-6963. */
export function hasLegacyInjectedProvider(): boolean {
  if (typeof window === 'undefined') return false
  const candidate = (window as unknown as { ethereum?: unknown }).ethereum
  return Boolean(candidate && typeof candidate === 'object')
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const data = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  if (typeof data?.mobile === 'boolean') return data.mobile
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}
