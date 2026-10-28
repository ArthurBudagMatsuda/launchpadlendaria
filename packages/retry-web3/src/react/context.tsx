'use client'

import { createContext, useContext } from 'react'
import type { RetryWeb3Config, RetryWeb3Settings } from '../config/wagmi.js'

export const RetryWeb3Context = createContext<RetryWeb3Config | null>(null)

export function useRetryWeb3Config(): RetryWeb3Config {
  const value = useContext(RetryWeb3Context)
  if (!value) {
    throw new Error('RETRY Web3 hooks must be used inside <RetryWeb3Provider>.')
  }
  return value
}

/** Network target, WalletConnect availability and other app-level Web3 settings. */
export function useRetryWeb3Settings(): RetryWeb3Settings {
  return useRetryWeb3Config().settings
}
