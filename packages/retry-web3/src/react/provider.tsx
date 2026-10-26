'use client'

import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'
import { type State, WagmiProvider } from 'wagmi'
import { createRetryQueryClient } from '../config/query-client.js'
import {
  type CreateRetryWeb3ConfigOptions,
  createRetryWeb3Config,
  type RetryWeb3Config,
} from '../config/wagmi.js'
import { logWeb3Diagnostic, setRetryWeb3Debug } from '../lib/logger.js'
import { RetryWeb3Context } from './context.js'

export interface RetryWeb3ProviderProps {
  children: ReactNode
  /**
   * Config from `createRetryWeb3Config`. In Next.js create it once on the
   * client (see the integration guide) so the server can derive `initialState`
   * from the same options.
   */
  config?: RetryWeb3Config | undefined
  /** Used only when `config` is not provided. Read once on mount. */
  options?: CreateRetryWeb3ConfigOptions | undefined
  /** From `getRetryInitialState(config, cookie)` in a Server Component. */
  initialState?: State | undefined
  queryClient?: QueryClient | undefined
  /** Restore the previous session on load. Default true. */
  reconnectOnMount?: boolean | undefined
  /** Console diagnostics (URLs redacted). Defaults to on in development. */
  debug?: boolean | undefined
}

/**
 * Root provider for RETRY Web3 state. Wraps wagmi, TanStack Query and the
 * RETRY settings context; every hook and component in this package reads from
 * it. All wallet state lives in wagmi, so there is a single source of truth.
 */
export function RetryWeb3Provider({
  children,
  config,
  options,
  initialState,
  queryClient,
  reconnectOnMount = true,
  debug,
}: RetryWeb3ProviderProps) {
  const [resolvedConfig] = useState(() => config ?? createRetryWeb3Config(options))
  const [resolvedQueryClient] = useState(() => queryClient ?? createRetryQueryClient())

  useEffect(() => {
    if (debug !== undefined) setRetryWeb3Debug(debug)
  }, [debug])

  useEffect(() => {
    for (const warning of resolvedConfig.settings.warnings) logWeb3Diagnostic('config', warning)
  }, [resolvedConfig])

  return (
    <WagmiProvider
      config={resolvedConfig.wagmiConfig}
      initialState={initialState}
      reconnectOnMount={reconnectOnMount}
    >
      <QueryClientProvider client={resolvedQueryClient}>
        <RetryWeb3Context.Provider value={resolvedConfig}>{children}</RetryWeb3Context.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
