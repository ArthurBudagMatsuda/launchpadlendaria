'use client'

import { useConnection } from 'wagmi'
import { type Address, shortenAddress } from '../../lib/address.js'
import { getExplorerAddressUrl } from '../../lib/explorer.js'
import { type RetryBalanceState, useRetryBalance } from './useRetryBalance.js'
import type { RetryConnectionStatus } from './useRetryConnectionStatus.js'
import { type RetryNetworkState, useRetryNetwork } from './useRetryNetwork.js'

export interface RetryConnectorInfo {
  id: string
  uid: string
  name: string
  type: string
  icon: string | undefined
}

export interface RetryWalletState {
  status: RetryConnectionStatus
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  isDisconnected: boolean
  /** Active account, checksummed. Re-read it on every render: wallets can switch accounts at any time. */
  address: Address | undefined
  /** `0x84A2...3F91` */
  shortAddress: string | undefined
  addresses: readonly Address[]
  connector: RetryConnectorInfo | undefined
  /** Chain the wallet is on (may be unsupported). */
  chainId: number | undefined
  networkName: string | undefined
  explorerAddressUrl: string | undefined
  network: RetryNetworkState
  balance: RetryBalanceState
}

/**
 * Everything a page needs about the user's wallet in one hook: connection,
 * address, connector, active network (with switch helpers) and ETH balance.
 * State comes from wagmi and the chain; nothing is cached outside them.
 */
export function useRetryWallet(): RetryWalletState {
  const connection = useConnection()
  const network = useRetryNetwork()
  const balance = useRetryBalance()

  const address = connection.isConnected ? connection.address : undefined
  const connector = connection.isConnected ? connection.connector : undefined

  return {
    status: connection.status,
    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting,
    isReconnecting: connection.isReconnecting,
    isDisconnected: connection.isDisconnected,
    address,
    shortAddress: address ? shortenAddress(address) : undefined,
    addresses: (connection.isConnected && connection.addresses) || [],
    connector: connector
      ? {
          id: connector.id,
          uid: connector.uid,
          name: connector.name,
          type: connector.type,
          icon: connector.icon,
        }
      : undefined,
    chainId: network.walletChainId,
    networkName: network.walletNetworkName,
    explorerAddressUrl: getExplorerAddressUrl(network.walletChainId, address),
    network,
    balance,
  }
}
